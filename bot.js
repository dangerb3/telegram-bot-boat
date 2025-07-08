const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch'); // You might need to install: npm install node-fetch@2

// Replace with your bot token from @BotFather
const BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE';

// Replace with your chat ID (you can get it by messaging @userinfobot)
const CHAT_ID = 'YOUR_CHAT_ID_HERE';

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Store last known state to avoid spam
let lastAvailableTickets = new Map();

async function checkEventAvailability() {
    try {
        console.log('🔍 Checking ticket availability...');
        
        const response = await fetch('https://mvms.tn-cloud.ru/api/afisha');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const events = await response.json();
        let availableDates = [];

        console.log('📅 Processing calendar data...');
        
        events.response.calendar.forEach(event => {
            if (event.event_id === "9563") {
                const tickets = parseInt(event.ticketcount);
                if (tickets > 0) {
                    availableDates.push({
                        date: event.eventday,
                        tickets: tickets
                    });
                }
            }
        });
        
        // Check for new available dates
        const newAvailableDates = [];
        const currentState = new Map();
        
        availableDates.forEach(dateInfo => {
            const key = `${dateInfo.date}`;
            currentState.set(key, dateInfo.tickets);
            
            // Check if this is a new availability or increased ticket count
            if (!lastAvailableTickets.has(key) || 
                lastAvailableTickets.get(key) !== dateInfo.tickets) {
                newAvailableDates.push(dateInfo);
            }
        });
        
        // Send notification if there are new available dates
        if (newAvailableDates.length > 0) {
            let message = "🎟️ *TICKETS AVAILABLE!*\n\n";
            message += "Event ID: 9563\n\n";
            
            newAvailableDates.forEach(dateInfo => {
                message += `📅 *${dateInfo.date}*\n`;
                message += `🎫 ${dateInfo.tickets} tickets available\n\n`;
            });
            
            message += "🔗 Check the website to book your tickets!";
            
            await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
            console.log('✅ Notification sent to Telegram!');
        } else if (availableDates.length > 0) {
            console.log('ℹ️ Tickets still available (no changes)');
        } else {
            console.log('❌ No tickets available for event 9563');
        }
        
        // Update last known state
        lastAvailableTickets = currentState;
        
        // Log current status
        if (availableDates.length > 0) {
            console.log("Current availability:");
            availableDates.forEach(dateInfo => {
                console.log(`- ${dateInfo.date} (${dateInfo.tickets} tickets)`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error checking tickets:', error.message);
        
        // Send error notification
        try {
            await bot.sendMessage(CHAT_ID, 
                `⚠️ Error checking tickets:\n\`${error.message}\``, 
                { parse_mode: 'Markdown' }
            );
        } catch (botError) {
            console.error('Failed to send error notification:', botError.message);
        }
    }
}

// Bot commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        `🤖 *Ticket Monitor Bot Started!*\n\n` +
        `I'll monitor event 9563 for available tickets.\n\n` +
        `Commands:\n` +
        `/check - Check tickets now\n` +
        `/status - Show monitoring status\n` +
        `/help - Show this help message\n\n` +
        `Your chat ID: \`${chatId}\``,
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/check/, async (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() === CHAT_ID) {
        await bot.sendMessage(chatId, '🔍 Checking tickets manually...');
        await checkEventAvailability();
    }
});

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() === CHAT_ID) {
        const nextCheck = new Date(Date.now() + (24 * 60 * 60 * 1000 / 5));
        bot.sendMessage(chatId, 
            `📊 *Monitor Status*\n\n` +
            `✅ Bot is running\n` +
            `🎯 Monitoring event: 9563\n` +
            `⏰ Check frequency: 5 times per day\n` +
            `📅 Next check: ~${nextCheck.toLocaleTimeString()}\n\n` +
            `Last known available dates: ${lastAvailableTickets.size}`,
            { parse_mode: 'Markdown' }
        );
    }
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        `🤖 *Ticket Monitor Bot Help*\n\n` +
        `This bot monitors event 9563 for ticket availability.\n\n` +
        `Commands:\n` +
        `/start - Start the bot\n` +
        `/check - Check tickets manually\n` +
        `/status - Show monitoring status\n` +
        `/help - Show this help\n\n` +
        `The bot automatically checks 5 times per day and sends notifications when tickets become available.`,
        { parse_mode: 'Markdown' }
    );
});

// Set up monitoring schedule (5 times per day = every 4.8 hours)
const checkInterval = (24 * 60 * 60 * 1000) / 5; // 4.8 hours in milliseconds

console.log('🚀 Starting Ticket Monitor Bot...');
console.log(`📅 Will check every ${(checkInterval / (60 * 60 * 1000)).toFixed(1)} hours`);

// Initial check
checkEventAvailability();

// Set up recurring checks
setInterval(checkEventAvailability, checkInterval);

// Keep the bot running
process.on('SIGINT', () => {
    console.log('\n🛑 Bot stopping...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Bot stopping...');
    process.exit(0);
});

console.log('✅ Bot is running! Press Ctrl+C to stop.');
