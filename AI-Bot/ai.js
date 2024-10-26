const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const { execSync } = require('child_process');

let commandQueue = [];
let executing = false;

const bot = mineflayer.createBot({
  host: 'ip address', // Minecraft server IP
  port: 25565,           // Minecraft server port
  username: 'bot',       // Bot's username
  version: '1.20.4'      // Minecraft version
});

// Detect visible blocks with optimized performance
function detectVisibleBlocksAndAskAI() {
  const blocksInSight = [];
  const maxDistance = 5;
  const stepSize = 3;
  const yawStep = Math.PI / 4;
  const pitchStep = Math.PI / 6;

  console.log('Starting block detection...');
  for (let yaw = -Math.PI / 2; yaw <= Math.PI / 2; yaw += yawStep) {
    for (let pitch = -Math.PI / 6; pitch <= Math.PI / 6; pitch += pitchStep) {
      const direction = new Vec3(
        Math.cos(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.sin(yaw) * Math.cos(pitch)
      );

      for (let t = 0; t < maxDistance; t += stepSize) {
        const position = bot.entity.position.offset(
          direction.x * t,
          direction.y * t,
          direction.z * t
        );
        const block = bot.world.getBlock(position);

        if (block && block.name !== 'air') {
          console.log(`Detected block: ${block.name} at ${block.position}`);
          blocksInSight.push(`${block.name} at ${block.position}`);
          break;  // Stop further checks along this ray
        }
      }
    }
  }

  if (!blocksInSight.length) {
    console.log("No visible blocks detected within 5 blocks.");
    bot.chat("No visible blocks detected within 5 feet.");
    return [];
  }

  const blockDescriptions = blocksInSight.join(", ");
  console.log(`Detected blocks: ${blockDescriptions}`);
  
  return blockDescriptions;
}

// Ask AI to decide action based on visible blocks and player input
function askAiToDecideAction(blocksDescription, playerCommand = "") {
  try {
    console.log(`Asking AI with blocks: '${blocksDescription}' and player command: '${playerCommand}'`);
    
    const aiPrompt = `Based on the environment: [${blocksDescription}] and player's command: [${playerCommand}], what should I do? Options are: move forward, move backward, turn left, turn right, jump, mine, place block, interact with mobs, or say something.`;
    const aiResponse = execSync(`ollama run llama3.2 "${aiPrompt}"`).toString();
    
    console.log('AI Response:', aiResponse);

    // Have the bot say the AI response in chat
    bot.chat(aiResponse.trim());

    // Extract commands like "move forward", "turn left", etc.
    const validCommands = ['move forward', 'move backward', 'turn left', 'turn right', 'jump', 'mine', 'place block', 'Say'];
    const parsedCommands = aiResponse.split('\n').filter(cmd => validCommands.some(validCmd => cmd.includes(validCmd)));

    if (parsedCommands.length > 0) {
      console.log('Parsed commands from AI:', parsedCommands);
    } else {
      console.log('No valid commands parsed from AI.');
    }

    return parsedCommands;
  } catch (err) {
    console.error('Error running AI:', err);
    return [];
  }
}

// Execute the next command in the queue
function executeNextCommand() {
  if (!commandQueue.length) {
    console.log('No more commands to execute.');
    executing = false;
    return;
  }

  const command = commandQueue.shift();
  console.log(`Executing command: ${command}`);

  try {
    if (command.includes('move')) {
      const direction = command.includes('forward') ? 'forward' : 'back';
      bot.setControlState(direction, true);
      setTimeout(() => {
        bot.setControlState(direction, false);
        executeNextCommand();
      }, 3000);
    } else if (command.includes('turn')) {
      const angle = command.includes('left') ? -Math.PI / 4 : Math.PI / 4;
      bot.look(bot.entity.yaw + angle, bot.entity.pitch, true);
      bot.chat(`Turning ${command.includes('left') ? 'left' : 'right'} 45 degrees`);
      setTimeout(executeNextCommand, 1000);
    } else if (command.includes('jump')) {
      bot.setControlState('jump', true);
      setTimeout(() => {
        bot.setControlState('jump', false);
        executeNextCommand();
      }, 500);
    } else if (command.includes('mine')) {
      const block = bot.blockAtCursor(4);
      if (block) {
        bot.dig(block, (err) => {
          if (err) console.error('Failed to mine block:', err);
          else bot.chat(`Mined block: ${block.name}`);
          executeNextCommand();
        });
      } else {
        bot.chat('No block to mine in range.');
        executeNextCommand();
      }
    } else if (command.includes('place block')) {
      const targetBlock = bot.blockAt(bot.entity.position.offset(1, -1, 0));
      if (bot.heldItem && targetBlock) {
        bot.placeBlock(targetBlock, bot.entity.position.offset(1, 0, 0), (err) => {
          if (err) console.error('Failed to place block:', err);
          else bot.chat('Block placed!');
          executeNextCommand();
        });
      } else {
        bot.chat('No valid block or item to place.');
        executeNextCommand();
      }
    } else if (command.includes('Say')) {
      const message = command.replace('Say', '').trim();
      bot.chat(message);
      console.log(`Bot said: ${message}`);
      executeNextCommand();
    } else {
      bot.chat(`Unknown command: ${command}`);
      executeNextCommand();
    }
  } catch (err) {
    console.error('Error executing command:', err);
    executeNextCommand();
  }
}

// Start executing AI's decided commands
function startCommandExecution(commands) {
  console.log('Starting command execution...');
  commandQueue = commands;
  executing = true;
  executeNextCommand();
}

// Listen to player chat and respond
bot.on('chat', (username, message) => {
  if (username === bot.username) return;

  console.log(`Message from ${username}: ${message}`);

  if (!executing) {
    bot.chat(`Got a command from ${username}: ${message}`);
    
    const blockDescriptions = detectVisibleBlocksAndAskAI();  // Detect visible blocks
    const aiDecidedCommands = askAiToDecideAction(blockDescriptions, message);  // Send blocks and message to AI

    if (aiDecidedCommands.length > 0) {
      startCommandExecution(aiDecidedCommands);  // Start executing AI commands
    } else {
      console.log('No executable commands from AI.');
    }
  } else {
    bot.chat(`I'm still executing the previous set of commands!`);
  }
});

// Event: When the bot spawns into the world
bot.on('spawn', () => {
  console.log('Bot spawned into the world!');
  bot.chat("Hello! I'm powered by AI and can make decisions based on my surroundings.");
});

// Error handling
bot.on('error', (err) => {
  console.error('Bot encountered an error:', err);
});

bot.on('kicked', (reason) => {
  console.log('Bot was kicked from the server:', reason);
});

// Reconnect the bot if disconnected
bot.on('end', () => {
  console.log('Bot disconnected, attempting to reconnect...');
  reconnectBot();
});

function reconnectBot() {
  setTimeout(() => {
    console.log('Reconnecting the bot...');
    bot = mineflayer.createBot(bot.options);
  }, 1000);
}
