const mineflayer = require('mineflayer');

// Function to generate a long random string for the message
function generateRandomMessage(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Function to create and manage a bot
function createBot(server_ip, server_port, baseUsername, botNumber) {
  const username = `${baseUsername}${botNumber}`; // Give each bot a unique username

  // Bot creation function with reconnect logic
  function startBot() {
    const bot = mineflayer.createBot({
      host: server_ip,       // Server IP
      port: server_port,     // Server port (default: 25565)
      username: username,    // Bot's unique username
    });

    bot.on('login', () => {
      console.log(`Bot ${username} has logged in.`);
      
      // Function to send long random messages infinitely
      function sendMessages() {
        const randomMessage = generateRandomMessage(256); // Generate a random message of 256 characters
        bot.chat(randomMessage); // Send the random chat message
        console.log(`Bot ${username} sent message: ${randomMessage}`);
        
        // Use setImmediate to continuously call the function without delay
        setImmediate(sendMessages);
      }

      // Start sending messages
      sendMessages();
    });

    bot.on('end', () => {
      console.log(`Bot ${username} has disconnected. Reconnecting...`);
      // Automatically try to reconnect after disconnect
      setTimeout(startBot, 5000); // Wait 5 seconds before reconnecting
    });

    bot.on('error', (err) => {
      console.error(`Error on bot ${username}:`, err);
    });
  }

  // Start the bot initially
  startBot();
}

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Get server details and chat message info from the user
readline.question('Enter the Minecraft server IP address: ', (server_ip) => {
  readline.question('Enter the Minecraft server port (default 25565): ', (server_port) => {
    server_port = server_port || 25565;
    readline.question('Enter the base bot username: ', (baseUsername) => {
      // Create 7 bots with unique names
      for (let i = 1; i <= 7; i++) {
        createBot(server_ip, server_port, baseUsername, i);
      }
      readline.close();
    });
  });
});