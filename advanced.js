const mineflayer = require('mineflayer');
const readline = require('readline');
const mcping = require('mc-ping-updated');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder'); // Load pathfinder

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let bots = []; // Store all bots
let foreverCommands = {}; // Store forever commands

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function detectServerVersion(host, port) {
  return new Promise((resolve, reject) => {
    mcping(host, port, (err, res) => {
      if (err) {
        console.error("Failed to detect server version:", err);
        resolve(null);
      } else {
        resolve(res.version.name);
      }
    });
  });
}

function stopAllTasks(bot) {
  bot.clearControlStates();
  bot.pathfinder.setGoal(null);
  if (bot.digging) bot.stopDigging();
  if (bot.usingItem) bot.deactivateItem();
  if (foreverCommands[bot.username]) {
    clearInterval(foreverCommands[bot.username]); // Stop the interval
    delete foreverCommands[bot.username]; // Remove the stored command
  }
  console.log(`All tasks have been stopped for bot ${bot.username}.`);
}

// Function to attack a specific player
function attackPlayer(bot, playerName) {
  const target = bot.players[playerName]?.entity;
  if (target) {
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
    bot.on('physicsTick', () => {
      if (bot.entity.position.distanceTo(target.position) < 2) {
        const sword = bot.inventory.items().find(item => item.name.includes('sword'));
        if (sword) bot.equip(sword, 'hand');
        bot.lookAt(target.position.offset(0, target.height, 0));
        bot.attack(target);
      }
    });
    console.log(`Bot is attacking player ${playerName}`);
  } else {
    console.log(`Player ${playerName} not found.`);
  }
}

// Function for practice mode (bots attack nearest entities)
function practiceAttack(bot) {
  const target = bot.nearestEntity(entity => entity.type === 'player' || entity.type === 'mob');
  if (target) {
    bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true);
    bot.on('physicsTick', () => {
      if (bot.entity.position.distanceTo(target.position) < 2) {
        const sword = bot.inventory.items().find(item => item.name.includes('sword'));
        if (sword) bot.equip(sword, 'hand');
        bot.lookAt(target.position.offset(0, target.height, 0));
        bot.attack(target);
      }
    });
    console.log('Bot is attacking the nearest entity.');
  } else {
    console.log('No nearby entities found.');
  }
}

// Function to mine a block
function mineBlock(bot, blockName) {
  const block = bot.findBlock({
    matching: (block) => block.name === blockName
  });
  if (block) {
    bot.dig(block, (err) => {
      if (err) {
        console.log(`Failed to mine ${blockName}:`, err);
      } else {
        console.log(`Successfully mined ${blockName}`);
      }
    });
  } else {
    console.log(`Block ${blockName} not found nearby.`);
  }
}

function followPlayer(bot, targetPlayerName) {
  const target = bot.players[targetPlayerName]?.entity;
  if (target) {
    const goal = new goals.GoalFollow(target, 2);
    bot.pathfinder.setGoal(goal, true);
    console.log(`Bot is now following ${targetPlayerName}.`);
  } else {
    console.log(`Player ${targetPlayerName} not found.`);
  }
}

// Function to shoot at a player for a specified number of seconds
function shootAtPlayer(bot, playerName, duration) {
  const target = bot.players[playerName]?.entity;
  if (target) {
    const bow = bot.inventory.items().find(item => item.name.includes('bow'));
    if (bow) bot.equip(bow, 'hand');

    bot.pathfinder.setGoal(new goals.GoalFollow(target, 10), true);

    const shootInterval = setInterval(() => {
      bot.lookAt(target.position.offset(0, target.height, 0));
      bot.activateItem(); // Start charging the bow

      setTimeout(() => {
        bot.deactivateItem(); // Release the arrow
      }, 3000); // Charge for 3 second before releasing
    }, 1000); // Shoot every 1 seconds

    setTimeout(() => {
      clearInterval(shootInterval); // Stop shooting after the specified duration
      console.log(`Stopped shooting at ${playerName}`);
    }, duration * 1000);
  } else {
    console.log(`Player ${playerName} not found.`);
  }
}

// Function to block using a shield
function blockWithShield(bot, duration) {
  const shield = bot.inventory.items().find(item => item.name.includes('shield'));
  if (shield) {
    bot.equip(shield, 'hand');
    bot.setControlState('block', true); // Start blocking

    setTimeout(() => {
      bot.setControlState('block', false); // Stop blocking
      console.log('Stopped blocking');
    }, duration * 1000);
  } else {
    console.log('No shield found in inventory.');
  }
}

// Function to throw an item (like a potion)
function throwItem(bot, itemName) {
  const item = bot.inventory.items().find(item => item.name.includes(itemName));
  if (item) {
    bot.equip(item, 'hand');
    bot.tossStack(item); // Toss the item
    console.log(`Threw ${itemName}`);
  } else {
    console.log(`${itemName} not found in inventory.`);
  }
}

// Function to use an item (like a potion or food)
function useItem(bot, itemName) {
  const item = bot.inventory.items().find(item => item.name.includes(itemName));
  if (item) {
    bot.equip(item, 'hand');
    bot.activateItem(); // Start using the item

    setTimeout(() => {
      bot.deactivateItem(); // Stop using the item after 3 seconds
      console.log(`Used ${itemName}`);
    }, 3000);
  } else {
    console.log(`${itemName} not found in inventory.`);
  }
}

// Function to heal the bot using a health item
function healBot(bot, itemName) {
  const food = bot.inventory.items().find(item => item.name.includes(itemName));
  if (food) {
    bot.equip(food, 'hand');
    bot.activateItem(); // Start eating the food or using the health item

    setTimeout(() => {
      bot.deactivateItem(); // Stop eating after 2 seconds
      console.log('Bot healed');
    }, 2000);
  } else {
    console.log(`${itemName} not found in inventory.`);
  }
}

// Function to spam TNT and light it
function tntSpam(bot, duration) {
  const tnt = bot.inventory.items().find(item => item.name.includes('tnt'));
  const flintAndSteel = bot.inventory.items().find(item => item.name.includes('flint_and_steel'));

  if (tnt && flintAndSteel) {
    bot.equip(tnt, 'hand');
    console.log('Equipped TNT.');

    const spamInterval = setInterval(() => {
      const targetPos = bot.entity.position.offset((Math.random() * 4) - 2, 0, (Math.random() * 4) - 2);

      const blockBelow = bot.blockAt(bot.entity.position.offset(0, -1, 0));
      if (blockBelow) {
        bot.placeBlock(blockBelow, targetPos, () => {
          bot.equip(flintAndSteel, 'hand');
          bot.lookAt(targetPos); // Look at the TNT block
          bot.activateItem(); // Ignite the TNT
          console.log('TNT placed and ignited.');
        });
      }
    }, 10); // Place and ignite TNT every .01 second

    setTimeout(() => {
      clearInterval(spamInterval); // Stop spamming after the duration
      console.log('Stopped spamming TNT.');
    }, duration * 1000);
  } else {
    console.log('TNT or Flint & Steel not found.');
  }
}

// Function for random movement
function moveRandomly(bot) {
  const directions = ['forward', 'back', 'left', 'right', 'jump'];

  const moveInterval = setInterval(() => {
    const randomDirection = directions[Math.floor(Math.random() * directions.length)];
    bot.setControlState(randomDirection, true);

    setTimeout(() => {
      bot.setControlState(randomDirection, false);
    }, Math.random() * 500 + 500); // Random duration between 500ms to 1000ms
  }, 1000); // Move randomly every second

  setTimeout(() => {
    clearInterval(moveInterval); // Stop random movement after some time
    console.log('Stopped random movement.');
  }, 15000); // Randomly move for 15 seconds
}

// Ensure a proper jump command
function handleJump(bot) {

    // Set jump control to true
    bot.setControlState('jump', true);

    // Set jump to false after a short timeout
    setTimeout(() => {
        bot.setControlState('jump', false); // End the jump
    }, 500); // Adjust the timeout duration as needed
}

// Function to handle repeatForever commands for all bots
function repeatForeverAllBots(command) {
    bots.forEach((bot) => {
        if (foreverCommands[bot.username]) {
            clearInterval(foreverCommands[bot.username]); // Clear previous intervals if they exist
        }

        foreverCommands[bot.username] = setInterval(() => {
            const args = command.split(' ');
            const mainCommand = args[0];

            switch (mainCommand) {
                case 'forward':
                    bot.setControlState('forward', true);
                    break;
                case 'backward':
                    bot.setControlState('back', true);
                    break;
                case 'left':
                    bot.setControlState('left', true);
                    break;
                case 'right':
                    bot.setControlState('right', true);
                    break;
                case 'stop':
                    stopAllTasks(bot);
                    clearInterval(foreverCommands[bot.username]);
                    break;
                case 'jump':
                    handleJump(bot)
                    break;
                case 'sprint':
                    bot.setControlState('sprint', true);
                    break;
                case 'jump':
                    bot.setControlState('jump', true);
                    setTimeout(() => bot.setControlState('jump', false), 500);
                case 'crouch':
                    bot.setControlState('sneak', true);
                    break;
                case 'look':
                    const [, pitch, yaw] = args.slice(1).map(Number);
                    bot.look(pitch, yaw);
                    break;
                case 'turn':
                    const degrees = parseInt(args[1]);
                    bot.look(bot.entity.yaw + (degrees * Math.PI / 180), bot.entity.pitch);
                    break;
                case 'follow':
                    followPlayer(bot, args[1]);
                    break;
                case 'attack':
                    attackPlayer(bot, args[1]);
                    break;
                case 'practice':
                    practiceAttack(bot);
                    break;
                case 'fly':
                    bot.creative.startFlying();
                    console.log(`${bot.username} is flying.`);
                    break;
                case 'stopfly':
                    bot.creative.stopFlying();
                    console.log(`${bot.username} stopped flying.`);
                    break;
                case 'mine':
                    mineBlock(bot, args[1]);
                    break;
                case 'msg':
                    const targetPlayer = args[1];
                    const msgContent = args.slice(2).join(' ');
                    bot.chat(`/tell ${targetPlayer} ${msgContent}`);
                    console.log(`${bot.username} sent a private message to ${targetPlayer}: ${msgContent}`);
                    break;
                case 'chat':
                    const chatContent = args.slice(1).join(' ');
                    bot.chat(chatContent);
                    console.log(`${bot.username} sent a public message: ${chatContent}`);
                    break;
                default:
                    console.log(`Unknown command: ${mainCommand}`);
            }
        }, 1000); // Repeats every 1 second
    });
}

// Function to set up bot behavior
function setupBotBehavior(bot) {
    // Ensure the pathfinder plugin is loaded before using it
    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        console.log(`Bot ${bot.username} has spawned.`);

        // Ensure the bot has fully spawned and only then call setMovements
        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);

        // Check if the pathfinder is initialized before calling setMovements
        if (bot.pathfinder) {
            bot.pathfinder.setMovements(movements); // Now this should work
        } else {
            console.error('Pathfinder plugin is not loaded correctly.');
        }

        // Add other event listeners after the bot has spawned
        bot.on('chat', (username, message) => {
            const args = message.split(' ');
            const command = args[0];

            switch (command) {
                case 'forever':
                    repeatForeverAllBots(args.slice(1).join(' ')); // Apply the forever command to all bots
                    break;
                case 'forward':
                    bot.setControlState('forward', true);
                    break;
                case 'backward':
                    bot.setControlState('back', true);
                    break;
                case 'jump':
                    handleJump(bot)
                case 'left':
                    bot.setControlState('left', true);
                    break;
                case 'right':
                    bot.setControlState('right', true);
                    break;
                case 'stop':
                    stopAllTasks(bot);
                    clearInterval(foreverCommands[username]); // Use 'username' instead of 'player'
                    break;
                case 'jump':
                    bot.setControlState('jump', true);
                    setTimeout(() => bot.setControlState('jump', false), 500);
                    break;
                case 'sprint':
                    bot.setControlState('sprint', true);
                    break;
                case 'crouch':
                    bot.setControlState('sneak', true);
                    break;
                case 'look':
                    const [, pitch, yaw] = args.slice(1).map(Number);
                    bot.look(pitch, yaw);
                    break;
                case 'turn':
                    const degrees = parseInt(args[1]);
                    bot.look(bot.entity.yaw + (degrees * Math.PI / 180), bot.entity.pitch);
                    break;
                case 'follow':
                    followPlayer(bot, args[1]);
                    break;
                case 'attack':
                    attackPlayer(bot, args[1]);
                    break;
                case 'practice':
                    practiceAttack(bot);
                    break;
                case 'fly':
                    bot.creative.startFlying();
                    console.log(`${username} commanded the bot to fly.`);
                    break;
                case 'stopfly':
                    bot.creative.stopFlying();
                    console.log(`${username} commanded the bot to stop flying.`);
                    break;
                case 'mine':
                    mineBlock(bot, args[1]);
                    break;
                case 'msg':
                    const targetPlayer = args[1];
                    const msgContent = args.slice(2).join(' ');
                    bot.chat(`/tell ${targetPlayer} ${msgContent}`);
                    console.log(`${username} sent a private message to ${targetPlayer}: ${msgContent}`);
                    break;
                case 'chat':
                    const chatContent = args.slice(1).join(' ');
                    bot.chat(chatContent);
                    console.log(`${username} sent a public message: ${chatContent}`);
                    break;
                case 'forever':
                    repeatForever(bot, username, args.slice(1).join(' '));
                    break;
                case 'shoot':
                    const playerName = args[1];
                    const duration = parseInt(args[2]) || 5;
                    shootAtPlayer(bot, playerName, duration);
                    break;
                case 'tntspam':
                    const tntDuration = parseInt(args[1]) || 5;
                    tntSpam(bot, tntDuration);
                    break;
                case 'random':
                    moveRandomly(bot);
                    break;
                case 'throw':
                    throwItem(bot, args[1]);
                    break;
                case 'use':
                    useItem(bot, args[1]);
                    break;
                case 'heal':
                    useItem(bot, args[1]);
                    break;
                case 'block':
                    blockWithShield(bot, parseInt(args[1]) || 5);
                    break;
                default:
                    console.log(`Unknown command: ${command}`);
            }
        });
    });

  bot.on('error', (err) => {
    console.error(`Bot ${bot.username} encountered an error:`, err);
  });

  bot.on('end', (reason) => {
    console.log(`Bot ${bot.username} disconnected: ${reason}`);
    reconnectBot(bot.username, bot._client.socket._host, bot._client.socket._port, bot.version);
  });
}

function reconnectBot(username, host, port, version, delayMs = 5000) {
  console.log(`Reconnecting bot ${username} in 5 seconds...`);
  
  // Remove the bot from the active bots list before reconnecting to avoid duplicates
  bots = bots.filter((b) => b.username !== username);

  setTimeout(() => {
    try {
      const bot = mineflayer.createBot({
        host,
        port,
        username,
        version,
      });

      bot.loadPlugin(pathfinder); // Load pathfinder plugin on reconnect
      setupBotBehavior(bot); // Reinitialize bot behavior after reconnect

      // Add bot back to the bots array
      bots.push(bot);

      console.log(`Bot ${username} reconnected.`);
    } catch (err) {
      console.error(`Failed to reconnect bot ${username}:`, err);
      attemptRejoin(username, host, port, version); // Try to reconnect again if it fails
    }
  }, delayMs); // Reconnect after a delay
}

// Create multiple bots
async function createBots() {
  const host = await askQuestion('Enter your IP address: ');
  const port = parseInt(await askQuestion('Enter the port number (default is 25565): ')) || 25565;

  console.log('Detecting server version...');
  const detectedVersion = await detectServerVersion(host, port);

  let version;
  if (detectedVersion) {
    console.log(`Detected server version: ${detectedVersion}`);
    const useDetected = await askQuestion(`Use detected version ${detectedVersion}? (y/n): `);
    version = useDetected.toLowerCase() === 'y' ? detectedVersion : await askQuestion('Enter the Minecraft version manually: ');
  } else {
    version = await askQuestion('Unable to detect server version. Please enter it manually: ');
  }

  const usernameFormat = await askQuestion('Enter the username format (use {n} for the bot number, e.g., player{n}): ');
  const numBots = parseInt(await askQuestion('How many bots do you want to spawn? '));
  const delay = parseInt(await askQuestion('What delay (in milliseconds) do you want between bot connections? '));

  console.log(`Spawning ${numBots} bots with a ${delay}ms delay between each...`);

  const bots = [];

  for (let i = 0; i < numBots; i++) {
    await new Promise((resolve) => {
      setTimeout(() => {
        const username = usernameFormat.replace('{n}', i + 1);

        const createBot = () => {
          let reconnecting = false; // Add a flag to control reconnection timing

          try {
            const bot = mineflayer.createBot({
              host,
              port,
              username,
              version,
            });

            bot.loadPlugin(pathfinder);
            setupBotBehavior(bot);

            bot.on('spawn', () => {
              console.log(`Bot ${username} connected successfully.`);
              reconnecting = false; // Reset reconnection flag on successful spawn
            });

            bot.on('end', (reason) => {
              if (!reconnecting) { // Ensure we only reconnect once after disconnection
                reconnecting = true;
                console.log(`Bot ${username} disconnected: ${reason}. Reconnecting in 5 seconds...`);
                setTimeout(() => {
                  createBot(); // Reconnect after 5 seconds
                }, 5000);
              }
            });

            bot.on('error', (err) => {
              console.error(`Error for bot ${username}:`, err);
            });

            bots.push(bot);
          } catch (error) {
            console.error(`Failed to create bot ${username}:`, error);
          }
        };

        createBot(); // Initial bot creation
        resolve();
      }, i * delay);
    });
  }

  console.log(`All ${bots.length} bots have been spawned.`);
  rl.close();
}

createBots().catch(console.error);