require('dotenv').config();
const token = process.env.TOKEN;
const TelegramBot = require('node-telegram-bot-api');
const { createCanvas, loadImage, registerFont } = require('canvas');
const express = require('express');
const fs = require('fs');
const path = require('path');

const bot = new TelegramBot(token, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

const TEXT_TEMPLATE = `
Напишите шаблон текста.

Заголовок необходимо обернуть в %%%.
Жирный текст необходимо обернуть в %%.
Курсив необходимо обернуть в %.
Описание не оборачивается.

Пустые строки между абзацами текста сохраняются и будут на итоговом изображении.
`

const TEXT_TEMPLATE_EXAMPLE = `
Пример:
%%%Заголовок%%%

%%99 февраля в 8:00%% %(Супер классное место)%
%%От 999р%%

А это супер классный пример текста описания, который можно скопировать и отправить боту! А вот ещё одно предложение.

А вот этот абзац текста будет с отступом сверху, потому что между двумя строками есть пустая строка.
`

const TEXT_SOURCE_EXAMPLE = 'Укажите текст источника. Например, "Фото: Первый Канал".'

// Папка для сохранения изображений
const IMAGE_SAVE_PATH = path.join(__dirname, 'images');
const ASSETS_PATH = path.join(__dirname, 'assets');
const FONT_BLACK_PATH = path.join(__dirname, 'fonts', 'gothampro_black.ttf');
const FONT_BOLD_PATH = path.join(__dirname, 'fonts', 'gothampro_bold.ttf');
const FONT_LIGHT_PATH = path.join(__dirname, 'fonts', 'gothampro_light.ttf');
const FONT_LIGHTITALIC_PATH = path.join(__dirname, 'fonts', 'gothampro_lightitalic.ttf');

// Создаем папку, если ее нет
if (!fs.existsSync(IMAGE_SAVE_PATH)) {
    fs.mkdirSync(IMAGE_SAVE_PATH);
}

// Проверка существования файлов шрифтов
if (!fs.existsSync(FONT_BLACK_PATH)) {
    console.error('Font file gothampro_black.ttf not found.');
    process.exit(1);
}
if (!fs.existsSync(FONT_BOLD_PATH)) {
    console.error('Font file gothampro_bold.ttf not found.');
    process.exit(1);
}
if (!fs.existsSync(FONT_LIGHT_PATH)) {
    console.error('Font file gothampro_light.ttf not found.');
    process.exit(1);
}
if (!fs.existsSync(FONT_LIGHTITALIC_PATH)) {
    console.error('Font file gothampro_lightitalic.ttf not found.');
    process.exit(1);
}

// Регистрируем пользовательские шрифты
registerFont(FONT_BLACK_PATH, { family: 'GothamProBlack' });
registerFont(FONT_BOLD_PATH, { family: 'GothamProBold' });
registerFont(FONT_LIGHT_PATH, { family: 'GothamProLight' });
registerFont(FONT_LIGHTITALIC_PATH, { family: 'GothamProLightItalic' });

// Команда старт
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Привет! Пришлите мне изображение.');
});

// Обработка изображений и текста
bot.on('message', async (msg) => {
    if (msg.photo) {
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        const file = await bot.getFile(photoId);
        const filePath = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

        bot.sendMessage(msg.chat.id, `
        ${TEXT_TEMPLATE}
        ${TEXT_TEMPLATE_EXAMPLE}`);

        bot.once('message', async (textMsg) => {
            const text = textMsg.text;

            bot.sendMessage(textMsg.chat.id, TEXT_SOURCE_EXAMPLE);

            bot.once('message', async (sourceMsg) => {
                const source = sourceMsg.text;

                try {
                    const userImage = await loadImage(filePath);
                    const background = await loadImage(path.join(ASSETS_PATH, 'background.png'));
                    const gradient = await loadImage(path.join(ASSETS_PATH, 'gradient.png'));
                    const logo = await loadImage(path.join(ASSETS_PATH, 'logo.png'));

                    const width = background.width;
                    const height = background.height;
                    const canvas = createCanvas(width, height);
                    const ctx = canvas.getContext('2d');

                    // Рисуем фоновое изображение
                    ctx.drawImage(background, 0, 0, width, height);

                    // Определяем размеры и позицию для изображения пользователя, сохраняя пропорции
                    const userImageAspectRatio = userImage.width / userImage.height;
                    const targetHeight = height / 2;
                    const targetWidth = width;
                    let sx = 0, sy = 0, sWidth = userImage.width, sHeight = userImage.height;

                    if (userImageAspectRatio > targetWidth / targetHeight) {
                        sWidth = userImage.height * (targetWidth / targetHeight);
                        sx = (userImage.width - sWidth) / 2;
                    } else {
                        sHeight = userImage.width / (targetWidth / targetHeight);
                        sy = (userImage.height - sHeight) / 2;
                    }

                    // Рисуем изображение пользователя в верхней части, обрезая его, если необходимо
                    ctx.drawImage(userImage, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

                    // Рисуем логотип в правом верхнем углу с отступами 35 пикселей и размером 90x90
                    const logoWidth = 90;
                    const logoHeight = 90;
                    const logoX = width - logoWidth - 35;
                    const logoY = 35;
                    ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);

                    // Рисуем градиент в нижней части
                    ctx.drawImage(gradient, 0, height - gradient.height, gradient.width, gradient.height);

                    // Настройки текста
                    ctx.fillStyle = '#FFFFFF';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';

                    const textStartY = 480;  // Начальная позиция текста
                    let textX = 65;
                    const maxWidth = width - 130;
                    const lineHeight = 30;
                    const titleLineHeight = 45;
                    let y = textStartY;

                    // Функция для рисования текста с различными стилями
                    function drawStyledText(text, font, x, y, maxWidth, lineHeight) {
                        ctx.font = font;
                        const words = text.split(' ');
                        let line = '';

                        for (let n = 0; n < words.length; n++) {
                            const testLine = line + words[n] + ' ';
                            const metrics = ctx.measureText(testLine);
                            const testWidth = metrics.width;
                            if (testWidth > maxWidth && n > 0) {
                                ctx.fillText(line, x, y);
                                line = words[n] + ' ';
                                y += lineHeight;
                            } else {
                                line = testLine;
                            }
                        }
                        ctx.fillText(line, x, y);
                        return y + lineHeight;
                    }

                    // Обработка текста
                    const lines = text.split('\n');
                    for (let line of lines) {
                        const parts = line.split(/(%%%.*?%%%|%%.*?%%|%.*?%)/g);

                        for (let part of parts) {
                            if (part.startsWith('%%%') && part.endsWith('%%%')) {
                                y = drawStyledText(part.slice(3, -3).toUpperCase(), '47px "GothamProBlack"', textX, y, maxWidth, titleLineHeight);
                            } else if (part.startsWith('%%') && part.endsWith('%%')) {
                                y = drawStyledText(part.slice(2, -2), '25px "GothamProBold"', textX, y, maxWidth, lineHeight);
                            } else if (part.startsWith('%') && part.endsWith('%')) {
                                y = drawStyledText(part.slice(1, -1), '25px "GothamProLightItalic"', textX, y, maxWidth, lineHeight);
                            } else {
                                y = drawStyledText(part, '25px "GothamProLight"', textX, y, maxWidth, lineHeight);
                            }
                            y -= lineHeight;  // Чтобы все части строки были на одной линии
                            textX += ctx.measureText(part.replace(/%%%|%%|%/g, '')).width;
                        }

                        y += lineHeight;  // Переход на новую строку
                        textX = 65;  // Сброс координаты X для новой строки
                    }

                    // Наложение источника
                    ctx.font = '12.5px "GothamProLightItalic"';
                    ctx.globalAlpha = 0.2;
                    ctx.fillText(source, 65, height - 50, width - 130);
                    ctx.globalAlpha = 1.0;

                    // Сохранение изображения
                    const buffer = canvas.toBuffer('image/png');
                    const imageName = `image_${Date.now()}.png`;
                    const imagePath = path.join(IMAGE_SAVE_PATH, imageName);
                    fs.writeFileSync(imagePath, buffer);

                    bot.sendMessage(sourceMsg.chat.id, 'Картинка успешно сохранена на сервере.');
                    bot.sendPhoto(sourceMsg.chat.id, imagePath);
                } catch (error) {
                    console.error(error);
                    bot.sendMessage(sourceMsg.chat.id, 'Произошла ошибка при обработке изображения.');
                }
            });
        });
    }
});

// Настройка сервера для проверки сохраненных изображений
app.use('/images', express.static(IMAGE_SAVE_PATH));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
