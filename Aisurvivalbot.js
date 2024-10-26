const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');
const minecraftData = require('minecraft-data');

// Create the bot
const bot = mineflayer.createBot({
  host: 'ip address',    // Minecraft server IP
  port: 25565,          // Minecraft server port
  username: 'SurvivalBot' // Bot username
});

let mcData;
bot.once('spawn', () => {
  mcData = minecraftData(bot.version);
  console.log('Bot has spawned.');
});

// Memory folder and Q-table setup
const memoryPath = path.join(__dirname, 'memory');
const qTablePath = path.join(memoryPath, 'qTable.json');
let qTable = {};

// Ensure the memory folder exists
if (!fs.existsSync(memoryPath)) {
  fs.mkdirSync(memoryPath);
}

// Load Q-table from memory if it exists
if (fs.existsSync(qTablePath)) {
  qTable = JSON.parse(fs.readFileSync(qTablePath, 'utf-8'));
}

// Save Q-table to the memory folder
function saveQTable() {
  fs.writeFileSync(qTablePath, JSON.stringify(qTable, null, 2));
  console.log('Q-table saved to memory.');
}

// Epsilon-greedy policy for selecting actions
const actions = ['forward', 'backward', 'left', 'right', 'jump', 'stop', 'sprint', 'mine', 'craft'];
const epsilon = 0.1;
const alpha = 0.1;  // Learning rate
const gamma = 0.9;  // Discount factor

// Get current bot state (position, health, hunger)
function getCurrentState() {
  const { x, y, z } = bot.entity.position;
  return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)},${bot.health},${bot.food}`;
}

// Initialize Q-table for states
function getQValues(state) {
  if (!qTable[state]) {
    qTable[state] = Array(actions.length).fill(0); // Initialize with zeros
  }
  return qTable[state];
}

// Choose an action based on the Q-table or random exploration
function chooseAction(state) {
  if (Math.random() < epsilon) {
    return Math.floor(Math.random() * actions.length);  // Exploration
  } else {
    const qValues = getQValues(state);
    return qValues.indexOf(Math.max(...qValues));  // Exploitation
  }
}

  // Event: Bot disconnected or kicked from server
  bot.on('end', () => {
    console.log('Bot has disconnected. Reconnecting in 5 seconds...');
    setTimeout(() => {
      createBot(); // Reconnect the bot
    }, 5000); // Reconnect after 5 seconds
  });

  // Event: Bot encountered an error
  bot.on('error', (err) => {
    console.log(`Bot encountered an error: ${err}. Reconnecting in 5 seconds...`);
    setTimeout(() => {
      createBot(); // Reconnect the bot after an error
    }, 5000);
  });

// Take the chosen action
function takeAction(action) {
  switch (actions[action]) {
    case 'forward':
      bot.setControlState('forward', true);
      setTimeout(() => bot.setControlState('forward', false), 100);
      break;
    case 'backward':
      bot.setControlState('back', true);
      setTimeout(() => bot.setControlState('back', false), 100);
      break;
    case 'left':
      bot.setControlState('left', true);
      setTimeout(() => bot.setControlState('left', false), 100);
      break;
    case 'right':
      bot.setControlState('right', true);
      setTimeout(() => bot.setControlState('right', false), 100);
      break;
    case 'jump':
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 100);
      break;
    case 'sprint':
      bot.setControlState('sprint', true);
      setTimeout(() => bot.setControlState('sprint', false), 200);
      break;
    case 'mine':
      const nearbyBlock = bot.findBlock({
        matching: (block) => block && block.name !== 'air',  // Avoid air blocks
        maxDistance: 32
      });
      
      if (nearbyBlock) {
        mineBlock(nearbyBlock.name);  // Mine the detected block dynamically
      } else {
        console.log('No suitable blocks found nearby for mining.');
      }
      break;
    case 'craft':
      craftItem('wooden_sword', 1);  // Example of crafting a wooden sword
      break;
    case 'stop':
      bot.clearControlStates();
      break;
  }
}

// Reward function based on bot's health and hunger
function getReward() {
  let reward = 0;

  if (bot.health < 10) {
    reward -= 10;
  }

  if (bot.food < 10) {
    reward -= 5;
  }

  return reward;
}

// Update the Q-table using the Q-learning formula
function updateQTable(state, action, reward, nextState) {
  const qValues = getQValues(state);
  const nextQValues = getQValues(nextState);
  const maxNextQ = Math.max(...nextQValues);

  // Update Q-value
  qValues[action] = qValues[action] + alpha * (reward + gamma * maxNextQ - qValues[action]);

  // Save the updated Q-table
  saveQTable();
}

// Stop digging or any other action when the bot is attacked
bot.on('entityHurt', (entity) => {
  if (entity === bot.entity) {
    console.log('The bot is being attacked! Stopping all actions.');
    bot.clearControlStates();  // Stop any ongoing movement
    bot.stopDigging();  // Stop the digging process if it's digging
  }
});

// Mining functionality with dynamic block type support and proper error handling
function mineBlock(blockType) {
  const block = bot.findBlock({
    matching: mcData.blocksByName[blockType]?.id,  // Use dynamic block type
    maxDistance: 32
  });

  if (block) {
    bot.dig(block, (err) => {
      if (err) {
        if (err.message === 'Digging aborted') {
          console.log('Digging was aborted, likely due to an interruption or conflict.');
        } else {
          console.log(`Error while mining ${blockType}: ${err.message}`);
        }
        return;  // Gracefully handle the error
      } else {
        console.log(`Successfully mined ${blockType}`);
      }
    });
  } else {
    console.log(`No ${blockType} found nearby or it's out of range.`);
  }
}

// Function to craft an item with crafting table support and ingredient check
function craftItem(itemName, count) {
  const item = mcData.itemsByName[itemName];

  if (!item) {
    console.log(`Item ${itemName} not found.`);
    return;
  }

  const recipe = bot.recipesFor(item.id, null, 1, bot.inventory);

  if (recipe.length === 0) {
    console.log(`No recipe found for ${itemName}.`);
    return;
  }

  const selectedRecipe = recipe[0];

  // Check if the bot has the required ingredients
  const missingIngredients = [];
  selectedRecipe.inShape.forEach(row => {
    row.forEach(ingredient => {
      const inventoryItem = bot.inventory.items().find(invItem => 
        invItem.type === ingredient.id && invItem.count >= ingredient.count
      );

      if (!inventoryItem) {
        missingIngredients.push(ingredient);
      }
    });
  });

  if (missingIngredients.length > 0) {
    console.log(`Missing ingredients for crafting ${itemName}:`, missingIngredients.map(ing => mcData.items[ing.id].name));
    return;
  }

  // Check if the recipe requires a crafting table
  if (selectedRecipe.requiresTable) {
    // Find a crafting table within range or in inventory
    const craftingTable = bot.findBlock({
      matching: mcData.blocksByName.crafting_table.id,
      maxDistance: 32
    });

    if (craftingTable) {
      // Use the nearby crafting table
      bot.craft(selectedRecipe, count, craftingTable, (err) => {
        if (err) {
          console.log(`Error while crafting ${itemName}: ${err.message}`);
        } else {
          console.log(`Successfully crafted ${count} ${itemName}(s).`);
        }
      });
    } else {
      console.log('No crafting table found nearby. Cannot craft item requiring a crafting table.');
    }
  } else {
    // Craft without a crafting table
    bot.craft(selectedRecipe, count, null, (err) => {
      if (err) {
        console.log(`Error while crafting ${itemName}: ${err.message}`);
      } else {
        console.log(`Successfully crafted ${count} ${itemName}(s).`);
      }
    });
  }
}

// Scanning nearby blocks and entities with delays to avoid spamming
let isScanning = false;

function scanNearby(botPosition, radius) {
  if (isScanning) return;
  isScanning = true;

  console.log(`Scanning within ${radius}-block radius...`);
  getNearbyBlocks(botPosition, radius);

  setTimeout(() => {
    getNearbyEntities(radius);
    isScanning = false;
  }, 2000);  // 2-second delay
}

// Get nearby blocks and log with delay
function getNearbyBlocks(botPosition, radius) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const position = botPosition.offset(dx, dy, dz);
        const block = bot.blockAt(position);
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (block && block.name !== 'air' && distance <= radius) {
          setTimeout(() => {
            console.log(`Block at: x=${block.position.x}, y=${block.position.y}, z=${block.position.z}, type=${block.name}`);
          }, distance * 100);  // Delay output based on distance
        }
      }
    }
  }
}

// Get nearby entities and log with delay
function getNearbyEntities(radius) {
  const entities = bot.entities;
  for (const id in entities) {
    const entity = entities[id];
    if (entity !== bot.entity) {
      const pos = entity.position;
      const dx = bot.entity.position.x - pos.x;
      const dy = bot.entity.position.y - pos.y;
      const dz = bot.entity.position.z - pos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance <= radius) {
        setTimeout(() => {
          console.log(`Entity (${entity.name}) at: x=${pos.x}, y=${pos.y}, z=${pos.z}, distance=${distance.toFixed(2)} blocks`);
        }, distance * 100);
      }
    }
  }
}

// Bot's learning loop on each physics tick
bot.on('physicTick', () => {
  const state = getCurrentState();
  const action = chooseAction(state);
  takeAction(action);

  const nextState = getCurrentState();
  const reward = getReward();
  updateQTable(state, action, reward, nextState);

  // Scan nearby blocks and entities
  scanNearby(bot.entity.position, 5);

  // If the bot's health is lower than max, stop all actions
  if (bot.health < bot.maxHealth) {
    stopAllActions();
  }
});

// Initialize bot with spawn behavior
bot.on('spawn', () => {
  console.log('Bot has spawned in the world.');
});
