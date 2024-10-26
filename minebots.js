const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

const BOT_COUNT = 7;
const bots = [];
let mcData;
let stopMining = false;
let lastMiningCommand = null; // Store the last command to repeat indefinitely
const SUPERVISOR_INDEX = 0; // The first bot will be the supervisor
const cheats = true; // Enable cheats for teleportation
let allReady = false; // To check if all bots are ready
let readyCount = 0; // To count the number of ready bots

// Modified createBot function to handle readiness
function createBot(index) {
    const bot = mineflayer.createBot({
        host: 'ip address',
        port: 25565,
        username: `MinerBot_${index}`
    });

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        mcData = minecraftData(bot.version);
        console.log(`MinerBot_${index} spawned`);
        bot.chat(`MinerBot_${index} reporting for duty!`);

        const defaultMove = new Movements(bot, mcData);
        bot.pathfinder.setMovements(defaultMove);

        // Increment the ready counter when the bot is spawned
        readyCount++;
        if (readyCount === BOT_COUNT) {
            allReady = true; // All bots are ready
            console.log('All bots are ready. Starting synchronized mining...');
            supervisorSignalMining();
        }

        if (index === SUPERVISOR_INDEX) {
            monitorMiningProgress(bot); // Supervisor bot starts monitoring
        }
    });

    bot.on('chat', (username, message) => handleChat(bot, username, message));
    bot.on('end', () => {
        console.log(`MinerBot_${index} disconnected. Reconnecting...`);
        setTimeout(() => createBot(index), 5000); // Reconnect after 5 seconds
    });

    bot.on('error', (err) => console.log(`MinerBot_${index} encountered an error: ${err.message}`));

    bots[index] = bot;
}

// Function for the supervisor to signal all bots to start mining
function supervisorSignalMining() {
    if (!allReady || !lastMiningCommand) return; // Wait until all bots are ready and there's a command to execute
    stopMining = false;

    // Loop through each bot and issue the last mining command issued by the player
    for (let bot of bots) {
        bot.chat(lastMiningCommand); // Use the last mining command dynamically
    }

    console.log('Supervisor signaled all bots to start mining with the command:', lastMiningCommand);
}

// Initialize all bots
for (let i = 0; i < BOT_COUNT; i++) {
    createBot(i);
}

// Chat command handler
function handleChat(bot, username, message) {
    if (username === bot.username || message.toLowerCase().includes('reporting for duty')) {
        return; // Ignore own messages and initial greetings
    }

    const command = message.toLowerCase();
    console.log(`Command received from ${username}: ${command}`);

    if (command === 'stop' || command === 'end') {
        stopMining = true;
        console.log('Mining stopped.');
    } else if (command.startsWith('mine')) { // Process only mine commands
        stopMining = false;
        lastMiningCommand = command;
        console.log(`Command set to: ${command}. Executing indefinitely...`);
        executeCommandIndefinitely(bot, command);
    } else {
        console.log('Invalid command. Ignoring...');
    }
}

// Function to continuously execute the last command
function executeCommandIndefinitely(bot, command) {
    if (stopMining) return;

    const args = command.split(' ').slice(1).map(Number);
    if (args.length === 4 && args.every(val => !isNaN(val))) {
        const [startX, startY, startZ, size] = args;
        const miningArea = { startX, startY, startZ, size };
        startLayerByLayerMining(bot, miningArea);
    } else {
        console.log(`Unknown command: ${command}. Ignoring...`);
    }
}

function startLayerByLayerMining(bot, miningArea) {
    let { startX, startY, startZ, size } = miningArea;
    const botIndex = bots.indexOf(bot);
    const sectionWidth = Math.floor(size / BOT_COUNT);
    const botStartX = startX + botIndex * sectionWidth;
    const botEndX = botStartX + sectionWidth;
    let miningForward = true; // Start mining forward

    console.log(`MinerBot_${botIndex} assigned to mine from X=${botStartX} to X=${botEndX}`);

    function mineNextBlock() {
        if (stopMining) {
            console.log(`MinerBot_${botIndex}: Mining has been stopped.`);
            return;
        }

        let blockFound = false;

        // Mine layer by layer, moving back and forth (zigzag)
        for (let y = startY; y > startY - size; y--) {
            let startXPos = botStartX;
            let endXPos = botEndX;

            for (let x = miningForward ? startXPos : endXPos - 1; 
                 miningForward ? x < endXPos : x >= startXPos; 
                 miningForward ? x++ : x--) {

                for (let z = startZ; z < startZ + size; z++) {
                    const pos = new Vec3(x, y, z);
                    const block = bot.blockAt(pos);
                    if (block && block.name !== 'air' && mcData.blocksByName[block.name]?.diggable) {
                        blockFound = true;
                        moveToBlockAndMine(bot, block, mineNextBlock);
                        return; // Mine the found block and then continue
                    }
                }
            }

            // After finishing one row, reverse direction
            miningForward = !miningForward;
        }

        if (!blockFound) {
            console.log(`MinerBot_${botIndex}: No diggable blocks found. Retrying in 0.05 seconds...`);
            setTimeout(() => {
                if (lastMiningCommand && !stopMining) {
                    executeCommandIndefinitely(bot, lastMiningCommand);
                }
            }, 50); // Retry in 0.05 seconds
        }
    }

    mineNextBlock();
}

// Move to the block's position and mine it
function moveToBlockAndMine(bot, block, callback) {
    if (cheats) {
        // Teleport directly to the block if cheats are enabled
        bot.chat(`/tp ${bot.username} ${block.position.x} ${block.position.y} ${block.position.z}`);
        setTimeout(() => {
            mineBlock(bot, block, callback);
        }, 0); // No delay after teleportation LOL
    } else {
        const goal = new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1);
        bot.pathfinder.setGoal(goal);

        bot.once('goal_reached', () => {
            console.log(`MinerBot_${bots.indexOf(bot)}: Reached ${block.name} at ${block.position}`);
            mineBlock(bot, block, callback);
        });

        bot.once('path_update', (result) => {
            if (result.status === 'noPath') {
                console.log(`MinerBot_${bots.indexOf(bot)}: Cannot find a path to ${block.name} at ${block.position}. Skipping...`);
                setTimeout(callback, 2000);
            }
        });
    }
}

// Mine a block and continue with the next one
function mineBlock(bot, block, callback) {
    bot.dig(block, (err) => {
        if (err) {
            console.log(`MinerBot_${bots.indexOf(bot)}: Error while mining ${block.name}: ${err.message}`);
        } else {
            console.log(`MinerBot_${bots.indexOf(bot)}: Successfully mined ${block.name} at ${block.position}`);
        }
        // Continue mining
        setTimeout(callback, 200);
    });
}

// Mine a block and continue with the next one
function mineBlock(bot, block, callback) {
    bot.dig(block, (err) => {
        if (err) {
            console.log(`MinerBot_${bots.indexOf(bot)}: Error while mining ${block.name}: ${err.message}`);
        } else {
            console.log(`MinerBot_${bots.indexOf(bot)}: Successfully mined ${block.name} at ${block.position}`);
        }
        // Continue mining
        setTimeout(callback, 200);
    });
}

// Supervisor bot function to monitor mining progress with optimized checks
function monitorMiningProgress(supervisorBot) {
    setInterval(() => {
        if (stopMining || !lastMiningCommand) return;

        // Check if all bots are idle (no movement or mining)
        let allBotsIdle = true;
        for (let bot of bots) {
            if (bot.pathfinder.isMoving() || bot.digging) {
                allBotsIdle = false;
                break;
            }
        }

        if (allBotsIdle && lastMiningCommand.startsWith('mine')) {
            console.log('Supervisor: All bots are idle. Resending the last command...');
            supervisorBot.chat(lastMiningCommand);

            // Let the supervisor follow the player's command as well
            executeCommandIndefinitely(supervisorBot, lastMiningCommand);
        }
    }, 50); // Delay of 0.05 to reduce lag
}
