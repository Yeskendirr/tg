const TelegramBot = require('node-telegram-bot-api');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const moment = require('moment');

// Ваш токен бота от BotFather
const BOT_TOKEN = '7723733985:AAGBoAa2C5HUVO3X_5KfOC4A4QO2MD4HZzY';

// Создаем экземпляр бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Привет! Отправьте мне PDF-файл, и я помогу вам извлечь данные.");
});

// Обработка сообщений с файлами
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (msg.document && msg.document.mime_type === 'application/pdf') {
        const fileId = msg.document.file_id;

        bot.sendMessage(chatId, "Файл получен. Начинаю обработку...");

        try {
            // Получаем ссылку на файл
            const file = await bot.getFile(fileId);
            const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;

            // Скачиваем PDF-файл
            const pdfBuffer = await downloadFile(fileUrl);

            // Извлекаем текст из PDF
            const extractedText = await pdfParse(pdfBuffer);

            // Обрабатываем текст для извлечения таблицы
            const tableData = processPDFTable(extractedText.text);

            // Логирование извлеченных данных
            console.log("Extracted table data:", tableData);

            // Если есть данные, отправляем их
            if (tableData.length > 0) {
                const resultMessage = countUniqueTopups(tableData);
                bot.sendMessage(chatId, resultMessage);
            } else {
                bot.sendMessage(chatId, "Не удалось обнаружить данные для обработки.");
            }

        } catch (error) {
            console.error("Ошибка обработки файла:", error);
            bot.sendMessage(chatId, "Произошла ошибка при обработке PDF-файла.");
        }
    } else if (!msg.document) {
        bot.sendMessage(chatId, "Пожалуйста, отправьте PDF-файл.");
    }
});

// Функция для скачивания файла
async function downloadFile(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
}

// Функция для обработки текста из PDF и извлечение таблицы
function processPDFTable(text) {
    const lines = text.split('\n');
    const tableData = [];

    lines.forEach((line) => {
        // Регулярное выражение для парсинга строки
        const match = line.match(/^(\d{2}\.\d{2}\.\d{2})\s*\+\s*([\d.,]+)\s*₸\s*(\S+)\s*(.*)$/);
        if (match) {
            const [_, datePart, amountPart, operationPart, detailsPart] = match;

            if (datePart && amountPart && operationPart && detailsPart) {
                const date = moment(datePart.trim(), "DD.MM.YY");
                if (date.isValid()) {
                    const amount = parseFloat(amountPart.replace(/[^0-9.,]/g, '').replace(',', '.'));
                    // Проверка на "Пополнение"
                    if (/пополнение|зачисление/i.test(operationPart)) {
                        tableData.push({
                            date: date,
                            amount: amount,
                            operation: operationPart.trim(),
                            details: detailsPart.trim()
                        });
                    }
                }
            }
        }
    });

    console.log("Processed table data:", tableData);
    return tableData;
}

function countUniqueTopups(data) {
	const uniqueSenders = new Set();

	data.forEach(item => {
			if (/пополнение|зачисление/i.test(item.operation)) {
					const sender = item.details.trim();
					uniqueSenders.add(sender);
			}
	});

	return `За 3 месяца было совершено ${uniqueSenders.size} уникальных пополнений. Уникальные отправители: \n${Array.from(uniqueSenders).join('\n')}`;
}
