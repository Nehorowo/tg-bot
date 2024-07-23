# Используем официальный Node.js образ в качестве базового
FROM node:18

# Устанавливаем рабочую директорию
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальной исходный код приложения
COPY . .

# Экспонируем порт
EXPOSE 3000

# Команда для запуска приложения
CMD ["node", "bot.js"]
