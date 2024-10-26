const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');

// Create the bot
const bot = mineflayer.createBot({
  host: 'ip address',  // Replace with your server IP
  port: 25565,            // Default Minecraft server port
  username: 'ProtectorBot'
});

// When the bot logs in
bot.on('login', () => {
  console.log('ProtectorBot has logged in.');
  startProtectionActions();  // Start protection actions
});

// Function to get a random delay between 1 and 3 seconds
function getRandomDelay() {
  return Math.random() * (3000 - 1000) + 1000;  // Random delay between 1 and 3 seconds
}

// Function to use /fill commands to remove anvils and sand
function removeAnvilsAndSand() {
  const radius = 20;  // Search radius around the bot
  const pos = bot.entity.position;

  // Remove all types of anvils and sand using /fill commands
  bot.chat(`/fill ${Math.floor(pos.x - radius)} ${Math.floor(pos.y)} ${Math.floor(pos.z - radius)} ${Math.floor(pos.x + radius)} ${Math.floor(pos.y + 100)} ${Math.floor(pos.z + radius)} air replace anvil`);
  bot.chat(`/fill ${Math.floor(pos.x - radius)} ${Math.floor(pos.y)} ${Math.floor(pos.z - radius)} ${Math.floor(pos.x + radius)} ${Math.floor(pos.y + 100)} ${Math.floor(pos.z + radius)} air replace chipped_anvil`);
  bot.chat(`/fill ${Math.floor(pos.x - radius)} ${Math.floor(pos.y)} ${Math.floor(pos.z - radius)} ${Math.floor(pos.x + radius)} ${Math.floor(pos.y + 100)} ${Math.floor(pos.z + radius)} air replace damaged_anvil`);
  bot.chat(`/fill ${Math.floor(pos.x - radius)} ${Math.floor(pos.y)} ${Math.floor(pos.z - radius)} ${Math.floor(pos.x + radius)} ${Math.floor(pos.y + 100)} ${Math.floor(pos.z + radius)} air replace sand`);
}

// Function to kill mobs like Ender Dragons and Withers
function killMobs() {
  bot.chat('/kill @e[type=!player]');  // Kill all entities that are not players
}

// Function to restore destroyed land
function restoreLand() {
  const pos = bot.entity.position;
  const radius = 20;

  bot.chat(`/fill ${Math.floor(pos.x - radius)} ${Math.floor(pos.y - 1)} ${Math.floor(pos.z - radius)} ${Math.floor(pos.x + radius)} ${Math.floor(pos.y - 1)} ${Math.floor(pos.z + radius)} dirt`);
}

// Protection bot’s main actions
function performProtectionAction() {
  const randomAction = Math.floor(Math.random() * 4);  // Choose between 4 different protection actions

  switch (randomAction) {
    case 0:
      removeAnvilsAndSand();  // Remove anvils and sand placed by the griefing bot
      break;
    case 1:
      killMobs();  // Kill mobs summoned by the griefing bot
      break;
    case 2:
      restoreLand();  // Restore destroyed land
      break;
  }

  // Schedule the next protection action after a random delay
  const delay = getRandomDelay();
  setTimeout(performProtectionAction, delay);
}

// Start the bot’s protection actions
function startProtectionActions() {
  setTimeout(performProtectionAction, getRandomDelay());  // Start with a random delay
}
