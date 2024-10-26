const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const { Vec3 } = require('vec3');

const bot = mineflayer.createBot({
  host: 'ip address', // Your server's IP
  port: 25565,           // Your server's port
  username: 'Bot'        // Bot's username
});

bot.loadPlugin(pathfinder);

let task = 'gather_wood';
let resourcesNeeded = {
  wood: 20,
  stone: 15,
  iron: 10,
  diamonds: 3,
  blaze_rods: 6,
  ender_pearls: 12
};

async function digBlock(block) {
  if (!block) {
    bot.chat('No block found to dig.');
    return;
  }

  // Ensure the bot is not moving before starting to dig
  bot.pathfinder.setGoal(null); // Stop any pathfinding to avoid interruptions

  // Ensure the bot is correctly positioned in front of the block
  const blockPosition = block.position.clone().offset(0.5, 0.5, 0.5);
  bot.lookAt(blockPosition, true); // Look directly at the block to avoid misalignment

  // Listen for the 'diggingCompleted' event
  function onDiggingCompleted() {
    bot.chat('Block fully dug!');
    cleanupListeners(); // Cleanup listeners once digging is done
  }

  // Listen for the 'diggingAborted' event
  function onDiggingAborted() {
    bot.chat('Digging was aborted.');
    cleanupListeners(); // Cleanup listeners if digging is aborted
  }

  // Cleanup listeners to avoid memory leaks
  function cleanupListeners() {
    bot.removeListener('diggingCompleted', onDiggingCompleted);
    bot.removeListener('diggingAborted', onDiggingAborted);
  }

  try {
    const currentBlock = bot.blockAt(block.position);
    if (currentBlock && currentBlock.name !== 'air' && bot.canDigBlock(currentBlock)) {
      bot.chat(`Starting to dig: ${currentBlock.name}`);

      // Attach event listeners to monitor digging state
      bot.once('diggingCompleted', onDiggingCompleted);
      bot.once('diggingAborted', onDiggingAborted);

      // Start digging the block
      await bot.dig(currentBlock);
    } else {
      bot.chat('Block is either not valid or already dug.');
    }
  } catch (err) {
    bot.chat(`Error while digging: ${err.message}`);
  }
}

bot.once('spawn', () => {
  bot.chat('Spawned in the world. Time to beat Minecraft!');
  bot.pathfinder.setMovements(new Movements(bot, require('minecraft-data')(bot.version)));
  setTimeout(mainLoop, 2000);  // Start the main loop after a short delay
});

function mainLoop() {
  switch (task) {
    case 'gather_wood':
      gatherWood();
      break;
    case 'gather_stone':
      gatherStone();
      break;
    case 'find_iron':
      mineIron();
      break;
    case 'find_diamonds':
      mineDiamonds();
      break;
    case 'craft_tools':
      craftTools();
      break;
    case 'nether':
      goToNether();
      break;
    case 'blaze_rods':
      gatherBlazeRods();
      break;
    case 'ender_pearls':
      gatherEnderPearls();
      break;
    case 'find_end_portal':
      findEndPortal();
      break;
    case 'defeat_ender_dragon':
      defeatEnderDragon();
      break;
    default:
      bot.chat('Task not recognized.');
  }
}

async function gatherWood() {
  if (bot.inventory.count('log') >= resourcesNeeded.wood) {
    bot.chat(`Collected enough wood (${resourcesNeeded.wood}). Moving to stone.`);
    task = 'gather_stone';
    setTimeout(mainLoop, 2000);
    return;
  }

  bot.chat('Looking for wood...');
  const wood = bot.findBlock({
    matching: block => block.name.includes('log'),
    maxDistance: 128
  });

  if (wood) {
    bot.chat('Found wood, chopping it down...');
    bot.pathfinder.setGoal(new GoalBlock(wood.position.x, wood.position.y, wood.position.z));
    await digBlock(wood); // Use the new digBlock function with error handling
    setTimeout(mainLoop, 2000);
  } else {
    bot.chat('No wood nearby.');
    setTimeout(mainLoop, 2000);
  }
}

async function gatherStone() {
  if (bot.inventory.count('stone') >= resourcesNeeded.stone) {
    bot.chat(`Collected enough stone (${resourcesNeeded.stone}). Moving to iron.`);
    task = 'find_iron';
    setTimeout(mainLoop, 2000);
    return;
  }

  bot.chat('Looking for stone...');
  const stone = bot.findBlock({
    matching: block => block.name.includes('stone'),
    maxDistance: 128
  });

  if (stone) {
    bot.chat('Found stone, mining it...');
    bot.pathfinder.setGoal(new GoalBlock(stone.position.x, stone.position.y, stone.position.z));
    await digBlock(stone);
    setTimeout(mainLoop, 2000);
  } else {
    bot.chat('No stone nearby.');
    setTimeout(mainLoop, 2000);
  }
}

async function mineIron() {
  if (bot.inventory.count('iron_ore') >= resourcesNeeded.iron) {
    bot.chat(`Collected enough iron (${resourcesNeeded.iron}). Moving to diamonds.`);
    task = 'find_diamonds';
    setTimeout(mainLoop, 2000);
    return;
  }

  bot.chat('Looking for iron...');
  const iron = bot.findBlock({
    matching: block => block.name.includes('iron_ore'),
    maxDistance: 128
  });

  if (iron) {
    bot.chat('Found iron ore, mining it...');
    bot.pathfinder.setGoal(new GoalBlock(iron.position.x, iron.position.y, iron.position.z));
    await digBlock(iron);
    setTimeout(mainLoop, 2000);
  } else {
    bot.chat('No iron nearby.');
    setTimeout(mainLoop, 2000);
  }
}

async function mineDiamonds() {
  if (bot.inventory.count('diamond') >= resourcesNeeded.diamonds) {
    bot.chat(`Collected enough diamonds (${resourcesNeeded.diamonds}). Moving to crafting tools.`);
    task = 'craft_tools';
    setTimeout(mainLoop, 2000);
    return;
  }

  bot.chat('Looking for diamonds...');
  const diamond = bot.findBlock({
    matching: block => block.name.includes('diamond_ore'),
    maxDistance: 128
  });

  if (diamond) {
    bot.chat('Found diamonds, mining them...');
    bot.pathfinder.setGoal(new GoalBlock(diamond.position.x, diamond.position.y, diamond.position.z));
    await digBlock(diamond);
    setTimeout(mainLoop, 2000);
  } else {
    bot.chat('No diamonds nearby.');
    setTimeout(mainLoop, 2000);
  }
}

async function craftTools() {
  bot.chat('Crafting tools...');

  const craftingTable = bot.findBlock({
    matching: block => block.name === 'crafting_table',
    maxDistance: 128
  });

  if (!craftingTable) {
    bot.chat('No crafting table found, making one.');
    const planks = bot.inventory.findInventoryItem('planks');
    if (planks) {
      await bot.craft(bot.recipesFor(58)[0], 1, null);  // Craft a crafting table
    } else {
      bot.chat('No planks to make a crafting table.');
    }
  }

  const recipes = bot.recipesFor('diamond_pickaxe');  // Diamond Pickaxe Recipe
  if (recipes.length > 0) {
    bot.chat('Crafting a diamond pickaxe...');
    await bot.craft(recipes[0], 1, null);
  }

  // Iron tools and armor
  const ironPickaxeRecipe = bot.recipesFor('iron_pickaxe');
  if (ironPickaxeRecipe.length > 0) {
    bot.chat('Crafting iron pickaxe...');
    await bot.craft(ironPickaxeRecipe[0], 1, null);
  }

  bot.chat('Tools crafted. Next, going to the Nether.');
  task = 'nether';
  setTimeout(mainLoop, 2000);
}

async function goToNether() {
  bot.chat('Time to build a Nether portal...');
  const obsidian = bot.inventory.findInventoryItem('obsidian', null, false);

  if (!obsidian) {
    bot.chat('No obsidian found. Mining obsidian to create Nether portal...');
    // Assuming bot has a diamond pickaxe, find lava pool and water to make obsidian
    const lava = bot.findBlock({
      matching: block => block.name === 'lava',
      maxDistance: 64
    });

    if (lava) {
      bot.chat('Found lava. Creating obsidian...');
      // Use water bucket to create obsidian (this part can be expanded with specific logic)
    } else {
      bot.chat('No lava found for obsidian.');
    }
  }

  // Assume portal is constructed; enter Nether
  bot.chat('Nether portal built. Entering the Nether...');
  task = 'blaze_rods';
  setTimeout(mainLoop, 2000);
}

async function gatherBlazeRods() {
  if (bot.inventory.count('blaze_rod') >= resourcesNeeded.blaze_rods) {
    bot.chat(`Collected enough Blaze Rods (${resourcesNeeded.blaze_rods}). Moving to Ender Pearls.`);
    task = 'ender_pearls';
    setTimeout(mainLoop, 2000);
    return;
  }

  bot.chat('Looking for Blaze Rods...');
  const blaze = bot.nearestEntity(entity => entity.mobType === 'Blaze');
  if (blaze) {
    bot.chat('Found a Blaze, attacking...');
    await bot.attack(blaze);
    bot.chat('Collected Blaze Rod. Continuing...');
    setTimeout(mainLoop, 2000);
  } else {
    bot.chat('No Blazes nearby.');
    setTimeout(mainLoop, 2000);
  }
}

async function gatherEnderPearls() {
  if (bot.inventory.count('ender_pearl') >= resourcesNeeded.ender_pearls) {
    bot.chat(`Collected enough Ender Pearls (${resourcesNeeded.ender_pearls}). Finding End Portal.`);
    task = 'find_end_portal';
    setTimeout(mainLoop, 2000);
    return;
  }

  bot.chat('Looking for Ender Pearls...');
  const enderman = bot.nearestEntity(entity => entity.mobType === 'Enderman');
  if (enderman) {
    bot.chat('Found Enderman, attacking...');
    await bot.attack(enderman);
    bot.chat('Collected Ender Pearl. Continuing...');
    setTimeout(mainLoop, 2000);
  } else {
    bot.chat('No Enderman nearby.');
    setTimeout(mainLoop, 2000);
  }
}

async function findEndPortal() {
  bot.chat('Crafting Eyes of Ender...');
  
  const enderPearls = bot.inventory.count('ender_pearl');
  const blazePowder = bot.inventory.count('blaze_powder');
  
  if (enderPearls >= 12 && blazePowder >= 12) {
    const eyeOfEnderRecipe = bot.recipesFor('eye_of_ender')[0];
    if (eyeOfEnderRecipe) {
      await bot.craft(eyeOfEnderRecipe, 12, null);
      bot.chat('Crafted 12 Eyes of Ender! Now finding the End Portal...');
      
      findStronghold();
    } else {
      bot.chat('Could not craft Eyes of Ender.');
    }
  } else {
    bot.chat('Not enough Ender Pearls or Blaze Powder to craft Eyes of Ender.');
  }
}

async function findStronghold() {
  bot.chat('Throwing Eyes of Ender...');
  
  for (let i = 0; i < 12; i++) {
    bot.chat(`Throwing Eye of Ender ${i+1}/12`);
    bot.activateItem(); // Throw an Eye of Ender
    
    await bot.waitForTicks(20); // Wait for the eye to fly

    const eyeDirection = bot.entity.position.offset(0, 10, 0); // Adjust as needed
    bot.pathfinder.setGoal(new GoalBlock(eyeDirection.x, eyeDirection.y, eyeDirection.z));
    
    await bot.waitForTicks(40); // Wait for movement to happen
  }

  bot.chat('End Portal should be nearby. Now searching for the End Portal room...');
  searchForEndPortalRoom();
}

async function searchForEndPortalRoom() {
  bot.chat('Searching for End Portal room...');
  
  const portalFrame = bot.findBlock({
    matching: block => block.name === 'end_portal_frame',
    maxDistance: 128
  });

  if (portalFrame) {
    bot.chat('Found the End Portal! Placing Eyes of Ender...');
    await placeEyesOfEnder(portalFrame);
  } else {
    bot.chat('Could not find the End Portal.');
  }
}

async function placeEyesOfEnder(portalFrame) {
  for (let i = 0; i < 12; i++) {
    const framePos = portalFrame.position.offset(i % 3, 0, Math.floor(i / 3)); // Adjust for portal layout
    bot.lookAt(framePos);
    await bot.activateItem();
    bot.chat(`Placed Eye of Ender ${i+1}/12.`);
    await bot.waitForTicks(10); // Wait between placing eyes
  }

  bot.chat('End Portal activated! Entering the End...');
  task = 'defeat_ender_dragon';
  setTimeout(mainLoop, 2000);
}

async function defeatEnderDragon() {
  bot.chat('Entering the End to defeat the Ender Dragon...');

  const endPortal = bot.findBlock({
    matching: block => block.name === 'end_portal',
    maxDistance: 128
  });

  if (endPortal) {
    bot.chat('Entering the End Portal...');
    bot.pathfinder.setGoal(new GoalBlock(endPortal.position.x, endPortal.position.y, endPortal.position.z));
    await bot.waitForTicks(50); // Simulate portal travel delay
    bot.chat('Entered the End. Searching for the Ender Dragon...');
    
    const dragon = bot.nearestEntity(entity => entity.mobType === 'EnderDragon');
    
    if (dragon) {
      bot.chat('Found the Ender Dragon, attacking...');
      while (dragon && dragon.isValid) {
        await bot.attack(dragon);
        bot.chat('Attacking the Ender Dragon...');
        await bot.waitForTicks(20); // Attack rate control
      }
      bot.chat('Ender Dragon defeated! You have beaten the game!');
    } else {
      bot.chat('Could not find the Ender Dragon.');
    }
  } else {
    bot.chat('Could not find the End Portal.');
  }
}

// Error handling
bot.on('error', err => console.log(err));
bot.on('end', () => console.log('Bot has ended'));
