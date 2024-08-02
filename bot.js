import { Telegraf, Scenes, session } from "telegraf"
const { BaseScene, Stage } = Scenes
import { createCanvas, loadImage, registerFont } from "canvas"
import express from "express"
import fs from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import "dotenv/config"

// Вставьте сюда токен вашего бота
const token = process.env.TOKEN
const bot = new Telegraf(token)
const app = express()
const PORT = process.env.PORT || 3000

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

const TEXT_SOURCE_EXAMPLE =
    'Укажите текст источника. Например, "Фото: Первый Канал".'
const TEXT_EXAMPLE_WITHOUT_GRADIENT = `
Пример:
Пещера дракона,
Лабиринты Федры,
Таверна "Киша"

Куда можно
сходить
в Петербурге?`

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Папка для сохранения изображений
const IMAGE_SAVE_PATH = join(__dirname, "images")
const ASSETS_PATH = join(__dirname, "assets")
const FONT_BLACK_PATH = join(__dirname, "fonts", "gothampro_black.ttf")
const FONT_BOLD_PATH = join(__dirname, "fonts", "gothampro_bold.ttf")
const FONT_LIGHT_PATH = join(__dirname, "fonts", "gothampro_light.ttf")
const FONT_LIGHTITALIC_PATH = join(
    __dirname,
    "fonts",
    "gothampro_lightitalic.ttf"
)

// Создаем папку, если ее нет
if (!fs.existsSync(IMAGE_SAVE_PATH)) {
    fs.mkdirSync(IMAGE_SAVE_PATH)
}

// Проверка существования файлов шрифтов
if (
    !fs.existsSync(FONT_BLACK_PATH) ||
    !fs.existsSync(FONT_BOLD_PATH) ||
    !fs.existsSync(FONT_LIGHT_PATH) ||
    !fs.existsSync(FONT_LIGHTITALIC_PATH)
) {
    console.error("One or more font files not found.")
    process.exit(1)
}

// Регистрируем пользовательские шрифты
registerFont(FONT_BLACK_PATH, { family: "GothamProBlack" })
registerFont(FONT_BOLD_PATH, { family: "GothamProBold" })
registerFont(FONT_LIGHT_PATH, { family: "GothamProLight" })
registerFont(FONT_LIGHTITALIC_PATH, { family: "GothamProLightItalic" })

// Сцена выбора типа карточки
const chooseCardTypeScene = new BaseScene("chooseCardTypeScene")
chooseCardTypeScene.enter((ctx) =>
    ctx.reply("Какую карточку хотите сделать?", {
        reply_markup: {
            keyboard: [[{ text: "Основная" }], [{ text: "Титульная" }]],
            one_time_keyboard: true,
            resize_keyboard: true,
        },
    })
)
chooseCardTypeScene.on("text", (ctx) => {
    const choice = ctx.message.text
    if (choice === "Основная") {
        ctx.session.useGradient = true
        ctx.reply(
            "Отлично! Отправьте мне изображение для верхней части карточки."
        )
        ctx.scene.enter("handleImageScene")
    } else if (choice === "Титульная") {
        ctx.session.useGradient = false
        ctx.reply(
            `Пожалуйста, введите текст для изображения. Переносы строк сохраняются. Между двумя абзацами необходимо оставить одну пустую строку.\n${TEXT_EXAMPLE_WITHOUT_GRADIENT}`
        )
        ctx.scene.enter("textWithoutGradientScene")
    } else {
        ctx.reply("Пожалуйста, выберите один из предложенных вариантов.")
    }
})

// Сцена обработки изображения
const handleImageScene = new BaseScene("handleImageScene")
handleImageScene.on("photo", async (ctx) => {
    const photo = ctx.message.photo.pop()
    const file = await ctx.telegram.getFile(photo.file_id)
    ctx.session.filePath = `https://api.telegram.org/file/bot${token}/${file.file_path}`
    ctx.reply(`${TEXT_TEMPLATE}\n${TEXT_TEMPLATE_EXAMPLE}`)
    await ctx.scene.enter("handleTextScene")
})

// Сцена обработки текста
const handleTextScene = new BaseScene("handleTextScene")
handleTextScene.on("text", (ctx) => {
    ctx.session.text = ctx.message.text
    ctx.reply(TEXT_SOURCE_EXAMPLE)
    ctx.scene.enter("handleSourceScene")
})

// Сцена обработки источника
const handleSourceScene = new BaseScene("handleSourceScene")
handleSourceScene.on("text", async (ctx) => {
    ctx.session.source = ctx.message.text
    await generateImage(ctx)
    ctx.scene.leave()
    askForAnotherGeneration(ctx)
})

// Сцена обработки текста без градиента
const textWithoutGradientScene = new BaseScene("textWithoutGradientScene")
textWithoutGradientScene.on("text", async (ctx) => {
    await generateImageWithoutGradient(ctx, ctx.message.text)
    ctx.scene.leave()
    askForAnotherGeneration(ctx)
})

// Создаем stage и регистрируем сцены
const stage = new Stage([
    chooseCardTypeScene,
    handleImageScene,
    handleTextScene,
    handleSourceScene,
    textWithoutGradientScene,
])
bot.use(session())
bot.use(stage.middleware())

// Команда старт
bot.start((ctx) => ctx.scene.enter("chooseCardTypeScene"))

// Функция, которая спрашивает пользователя, хочет ли он сгенерировать еще одно изображение
function askForAnotherGeneration(ctx) {
    ctx.reply("Хотите сгенерировать еще одно изображение?", {
        reply_markup: {
            keyboard: [[{ text: "Да" }], [{ text: "Нет" }]],
            one_time_keyboard: true,
            resize_keyboard: true,
        },
    })
    bot.on("text", (msg) => {
        if (msg.message.text === "Да") {
            ctx.scene.enter("chooseCardTypeScene")
        } else {
            ctx.reply(
                "Спасибо за использование бота! Если захотите создать новое изображение, просто отправьте команду /start."
            )
        }
    })
}

// Функция для рисования текста с различными стилями
function drawStyledText(ctx, text, font, x, y, maxWidth, lineHeight) {
    ctx.font = font
    const words = text.split(" ")
    let line = ""

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " "
        const metrics = ctx.measureText(testLine)
        const testWidth = metrics.width
        if (testWidth > maxWidth && n > 0) {
            ctx.fillText(line, x, y)
            line = words[n] + " "
            y += lineHeight
        } else {
            line = testLine
        }
    }
    ctx.fillText(line, x, y)
    return y + lineHeight
}

// Функция обработки источника и генерации изображения
async function generateImage(ctx) {
    const { filePath, text, source } = ctx.session

    try {
        const userImage = await loadImage(filePath)
        const background = await loadImage(join(ASSETS_PATH, "background.png"))
        const gradient = await loadImage(join(ASSETS_PATH, "gradient.png"))
        const logo = await loadImage(join(ASSETS_PATH, "logo.png"))

        const width = background.width
        const height = background.height
        const canvas = createCanvas(width, height)
        const canvasCtx = canvas.getContext("2d")

        // Рисуем фоновое изображение
        canvasCtx.drawImage(background, 0, 0, width, height)

        // Определяем размеры и позицию для изображения пользователя, сохраняя пропорции
        const userImageAspectRatio = userImage.width / userImage.height
        const targetHeight = height / 2
        const targetWidth = width
        let sx = 0,
            sy = 0,
            sWidth = userImage.width,
            sHeight = userImage.height

        if (userImageAspectRatio > targetWidth / targetHeight) {
            sWidth = userImage.height * (targetWidth / targetHeight)
            sx = (userImage.width - sWidth) / 2
        } else {
            sHeight = userImage.width / (targetWidth / targetHeight)
            sy = (userImage.height - sHeight) / 2
        }

        // Рисуем изображение пользователя в верхней части, обрезая его, если необходимо
        canvasCtx.drawImage(
            userImage,
            sx,
            sy,
            sWidth,
            sHeight,
            0,
            0,
            targetWidth,
            targetHeight
        )

        // Рисуем логотип в правом верхнем углу с отступами 35 пикселей и размером 90x90
        const logoWidth = 90
        const logoHeight = 90
        const logoX = width - logoWidth - 35
        const logoY = 35
        canvasCtx.drawImage(logo, logoX, logoY, logoWidth, logoHeight)

        // Рисуем градиент в нижней части
        if (gradient) {
            canvasCtx.drawImage(
                gradient,
                0,
                height - gradient.height,
                gradient.width,
                gradient.height
            )
        }

        // Настройки текста
        canvasCtx.fillStyle = "#FFFFFF"
        canvasCtx.textAlign = "left"
        canvasCtx.textBaseline = "top"

        const textStartY = 480 // Начальная позиция текста
        let textX = 65
        const maxWidth = width - 130
        const lineHeight = 30
        const titleLineHeight = 45
        let y = textStartY

        // Обработка текста
        const lines = text.split("\n")
        for (let line of lines) {
            const parts = line.split(/(%%%.*?%%%|%%.*?%%|%.*?%)/g)

            for (let part of parts) {
                if (part.startsWith("%%%") && part.endsWith("%%%")) {
                    y = drawStyledText(
                        canvasCtx,
                        part.slice(3, -3).toUpperCase(),
                        '47px "GothamProBlack"',
                        textX,
                        y,
                        maxWidth,
                        titleLineHeight
                    )
                } else if (part.startsWith("%%") && part.endsWith("%%")) {
                    y = drawStyledText(
                        canvasCtx,
                        part.slice(2, -2),
                        '25px "GothamProBold"',
                        textX,
                        y,
                        maxWidth,
                        lineHeight
                    )
                } else if (part.startsWith("%") && part.endsWith("%")) {
                    y = drawStyledText(
                        canvasCtx,
                        part.slice(1, -1),
                        '25px "GothamProLightItalic"',
                        textX,
                        y,
                        maxWidth,
                        lineHeight
                    )
                } else {
                    y = drawStyledText(
                        canvasCtx,
                        part,
                        '25px "GothamProLight"',
                        textX,
                        y,
                        maxWidth,
                        lineHeight
                    )
                }
                y -= lineHeight // Чтобы все части строки были на одной линии
                textX += canvasCtx.measureText(
                    part.replace(/%%%|%%|%/g, "")
                ).width
            }

            y += lineHeight // Переход на новую строку
            textX = 65 // Сброс координаты X для новой строки
        }

        // Наложение источника
        canvasCtx.font = '12.5px "GothamProLightItalic"'
        canvasCtx.globalAlpha = 0.2
        canvasCtx.fillText(source, 65, height - 50, width - 130)
        canvasCtx.globalAlpha = 1.0

        // Сохранение изображения
        const buffer = canvas.toBuffer("image/png")
        const imageName = `image_${Date.now()}.png`
        const imagePath = join(IMAGE_SAVE_PATH, imageName)
        fs.writeFileSync(imagePath, buffer)

        ctx.reply("Картинка успешно сохранена на сервере.")
        await ctx.replyWithPhoto({ source: imagePath })
    } catch (error) {
        console.error(error)
        ctx.reply("Произошла ошибка при обработке изображения.")
    }
}

// Функция генерации изображения без градиента
async function generateImageWithoutGradient(ctx, text) {
    try {
        const background = await loadImage(join(ASSETS_PATH, "bgFull.png"))

        const width = background.width
        const height = background.height
        const canvas = createCanvas(width, height)
        const canvasCtx = canvas.getContext("2d")

        // Рисуем фон
        canvasCtx.drawImage(background, 0, 0, width, height)

        // Выравнивание текста
        canvasCtx.textAlign = "center"
        canvasCtx.textBaseline = "middle"
        canvasCtx.font = '48px "GothamProBlack"'
        canvasCtx.fillStyle = "#FFFFFF"

        const textStartY = 480 // Начальная позиция текста
        let textX = width / 2
        const maxWidth = width - 130
        const lineHeight = 48
        const titleLineHeight = 48
        let y = textStartY

        // Обработка текста
        const lines = text.split("\n")
        const emptyIndex = lines.indexOf("")

        lines.forEach((line, index) => {
            if (emptyIndex && index > emptyIndex) {
                canvasCtx.fillStyle = "#FFA82B"
            }
            y = drawStyledText(
                canvasCtx,
                line.toUpperCase(),
                '47px "GothamProBlack"',
                textX,
                y,
                maxWidth,
                titleLineHeight
            )
            y += lineHeight - 40
        })

        // Сохраняем изображение
        const buffer = canvas.toBuffer("image/png")
        const imageName = `image_${Date.now()}.png`
        const imagePath = join(IMAGE_SAVE_PATH, imageName)
        fs.writeFileSync(imagePath, buffer)

        ctx.reply("Картинка успешно сохранена на сервере.")
        await ctx.replyWithPhoto({ source: imagePath })
    } catch (error) {
        console.error(error)
        ctx.reply("Произошла ошибка при обработке изображения.")
    }
}

// Настройка сервера для проверки сохраненных изображений
app.use("/images", express.static(IMAGE_SAVE_PATH))

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})

bot.launch()
