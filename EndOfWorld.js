const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');

// Create the bot
const bot = mineflayer.createBot({
  host: 'ip address',  // Replace with your server IP
  port: 25565,            // Default Minecraft server port
  username: 'EndOfWorldBot'
});

// When the bot logs in
bot.on('login', () => {
  console.log('Bot has logged in.');
  startBotActions();  // Start autonomous actions
});

// Function to get a random delay between 0.1 and 1 second for faster chaos
function getRandomDelay() {
  return Math.random() * (1000 - 100) + 100;  // Random delay between 100ms and 1000ms
}

// Function to teleport the bot to a nearby player
function teleportToPlayer() {
  const target = bot.nearestEntity(entity => entity.type === 'player');
  if (target) {
    const playerPos = target.position;
    bot.chat(`/tp @s ${Math.floor(playerPos.x)} ${Math.floor(playerPos.y)} ${Math.floor(playerPos.z)}`);  // Teleport to the player
  }
}

// Function to give itself blocks if inventory is empty
function giveBlocksIfNeeded() {
  const blockNeeded = bot.inventory.items().find(item => item.name.includes('tnt') || item.name.includes('anvil') || item.name.includes('sand'));

  if (!blockNeeded) {
    const blocks = ['tnt', 'anvil', 'sand'];
    const randomBlock = blocks[Math.floor(Math.random() * blocks.length)];
    bot.chat(`/give @s ${randomBlock} 64`);  // Give the bot a random block if inventory is empty
  }
}

// Function to drop 100 anvils 100 blocks above the player
function dropAnvilsOnPlayer() {
  const target = bot.nearestEntity(entity => entity.type === 'player');
  if (target) {
    const playerPos = target.position;
    for (let i = 0; i < 100; i++) {
      const blockX = Math.floor(playerPos.x);
      const blockY = Math.floor(playerPos.y + 100);  // 100 blocks above the player
      const blockZ = Math.floor(playerPos.z);
      bot.chat(`/setblock ${blockX} ${blockY - i} ${blockZ} anvil`);  // Drop anvil one block below each time
    }
  }
}

// Function to place a massive amount of sand above the player
function placeSandAbovePlayer() {
  const target = bot.nearestEntity(entity => entity.type === 'player');
  if (target) {
    const playerPos = target.position;
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        bot.chat(`/fill ${Math.floor(playerPos.x + x)} ${Math.floor(playerPos.y + 20)} ${Math.floor(playerPos.z + z)} ${Math.floor(playerPos.x + x)} ${Math.floor(playerPos.y + 40)} ${Math.floor(playerPos.z + z)} sand`);
      }
    }
  }
}

// Function to summon a bunch of mobs, including Ender Dragon and Wither, near a player
function summonBunchOfMobs() {
  const mobs = ['zombie', 'skeleton', 'creeper', 'ender_dragon', 'wither'];
  const target = bot.nearestEntity(entity => entity.type === 'player');
  if (target) {
    const playerPos = target.position;
    for (let i = 0; i < 20; i++) {  // Summon 20 random mobs
      const randomMob = mobs[Math.floor(Math.random() * mobs.length)];
      const summonX = Math.floor(playerPos.x) + Math.floor(Math.random() * 5 - 2);
      const summonZ = Math.floor(playerPos.z) + Math.floor(Math.random() * 5 - 2);
      bot.chat(`/summon ${randomMob} ${summonX} ${Math.floor(playerPos.y)} ${summonZ}`);
    }
  }
}

// Function to destroy a large area of blocks near a player
function destroyLargeAreaNearPlayer() {
  const target = bot.nearestEntity(entity => entity.type === 'player');
  if (target) {
    const playerPos = target.position;
    const radius = 20;  // Increase radius for larger destruction

    bot.chat(`/fill ${Math.floor(playerPos.x - radius)} ${Math.floor(playerPos.y - 1)} ${Math.floor(playerPos.z - radius)} ${Math.floor(playerPos.x + radius)} ${Math.floor(playerPos.y - 1)} ${Math.floor(playerPos.z + radius)} air`);
  }
}

// Autonomous function that chooses random chaotic actions targeting players
function performRandomAction() {
  const randomAction = Math.floor(Math.random() * 5);  // Choose between 5 different actions

  switch (randomAction) {
    case 0:
      teleportToPlayer();  // Teleport to the nearest player
      break;
    case 1:
      dropAnvilsOnPlayer();  // Drop anvils on the player
      break;
    case 2:
      summonBunchOfMobs();  // Summon a bunch of mobs
      break;
    case 3:
      destroyLargeAreaNearPlayer();  // Destroy a large area near the player
      break;
    case 4:
      placeSandAbovePlayer();  // Place a large amount of sand above the player
      break;
  }

  // Schedule the next action after a random delay
  const delay = getRandomDelay();
  setTimeout(performRandomAction, delay);
}

// Start the bot's chaotic autonomous behavior
function startBotActions() {
  setTimeout(performRandomAction, getRandomDelay());  // Start with a random delay
}
