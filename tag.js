const mineflayer = require('mineflayer');
const readline = require('readline');
const mcping = require('mc-ping-updated');
const { pathfinder, goals: { GoalBlock, GoalNear } } = require('mineflayer-pathfinder');
const Vec3 = require('vec3');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function detectServerVersion(host, port) {
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

function getRandomPositionWithinBounds(bot, center, range) {
  let x, z;
  do {
    x = center.x + (Math.random() * range * 2 - range);
    z = center.z + (Math.random() * range * 2 - range);
  } while (Math.abs(x - center.x) > range || Math.abs(z - center.z) > range);

  const y = bot.entity.position.y;
  return new Vec3(x, y, z);
}

function moveToRandomPosition(bot, center, range) {
  const targetPos = getRandomPositionWithinBounds(bot, center, range);
  bot.pathfinder.setGoal(new GoalBlock(targetPos.x, targetPos.y, targetPos.z));
}

function runAwayFrom(bot, itBot, center, range) {
  const direction = bot.entity.position.minus(itBot.entity.position).normalize();
  let fleePosition = bot.entity.position.plus(direction.scaled(10));

  // Ensure the fleeing position stays within bounds
  fleePosition = new Vec3(
    Math.max(center.x - range, Math.min(center.x + range, fleePosition.x)),
    fleePosition.y,
    Math.max(center.z - range, Math.min(center.z + range, fleePosition.z))
  );
  
  bot.pathfinder.setGoal(new GoalBlock(fleePosition.x, fleePosition.y, fleePosition.z));
}

function getClosestBot(itBot, bots) {
  let closestBot = null;
  let minDistance = Infinity;

  bots.forEach(bot => {
    if (bot !== itBot) {
      const distance = bot.entity.position.distanceTo(itBot.entity.position);
      if (distance < minDistance) {
        closestBot = bot;
        minDistance = distance;
      }
    }
  });

  return closestBot;
}

async function createBots() {
  const host = await askQuestion('Enter your IP address: ');
  const port = parseInt(await askQuestion('Enter the port number (default is 25565): ')) || 25565;

  console.log("Detecting server version...");
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
  const center = new Vec3(0, 0, 0);  // Center of the restricted area
  const range = 50; // 100x100 area boundary

  for (let i = 0; i < numBots; i++) {
    await new Promise((resolve) => {
      setTimeout(() => {
        const username = usernameFormat.replace('{n}', i + 1);
        const bot = mineflayer.createBot({
          host: host,
          port: port,
          username: username,
          version: version
        });

        // Load the pathfinder plugin into the bot
        bot.loadPlugin(pathfinder);

        bot.once('spawn', () => {
          console.log(`Bot ${username} has spawned!`);
          bots.push(bot);

          if (bots.length === numBots) {
            startTagGame(bots, center, range); // Start the tag game after all bots are spawned
          }

          resolve();
        });

        bot.on('error', (err) => {
          console.error(`Bot ${username} encountered an error:`, err);
          resolve();
        });

        bot.on('end', (reason) => {
          console.log(`Bot ${username} disconnected: ${reason}`);
        });
      }, i * delay);
    });
  }

  rl.close();
}

function startTagGame(bots, center, range) {
  let itBot = bots[Math.floor(Math.random() * bots.length)];
  console.log(`${itBot.username} is "It"!`);
  let attackCooldown = false; // Cooldown to prevent constant attacking
  let taggedCooldown = new Set(); // To track bots that can't be tagged back for 5 seconds
  let immobilizedBots = new Set(); // Bots immobilized for 3 seconds after being tagged

  bots.forEach(bot => {
    if (bot !== itBot) {
      setInterval(() => {
        if (!immobilizedBots.has(bot)) {
          const distanceToIt = bot.entity.position.distanceTo(itBot.entity.position);

          if (distanceToIt < 8) {
            runAwayFrom(bot, itBot, center, range);
          } else {
            moveToRandomPosition(bot, center, range);
          }
        }
      }, 1000);
    }
  });

  setInterval(() => {
    const targetBot = getClosestBot(itBot, bots);
    if (targetBot && !taggedCooldown.has(itBot)) {  // Can't tag back immediately
      // Move "It" toward the closest bot
      itBot.pathfinder.setGoal(new GoalNear(targetBot.entity.position.x, targetBot.entity.position.y, targetBot.entity.position.z, 1));

      const distanceToTarget = itBot.entity.position.distanceTo(targetBot.entity.position);

      if (distanceToTarget <= 3 && !attackCooldown) {
        // If close enough, attack the target
        itBot.attack(targetBot);
        console.log(`${itBot.username} has attacked ${targetBot.username}`);

        // Prevent the tagged bot from moving for 1.5 seconds
        immobilizedBots.add(targetBot);
        setTimeout(() => {
          immobilizedBots.delete(targetBot);
        }, 1500);  // 1.5 seconds of immobility

        // Prevent the "It" bot from tagging anyone for 5 seconds
        taggedCooldown.add(itBot);
        setTimeout(() => {
          taggedCooldown.delete(itBot);
        }, 5000);  // 5 seconds tag-back prevention

        // Switch roles: the attacked bot is now "It"
        itBot = targetBot;
        console.log(`${itBot.username} is now "It"!`);

        // Set a short cooldown to prevent immediate reattacking
        attackCooldown = true;
        setTimeout(() => attackCooldown = false, 500);  // 0.5-second attack cooldown
      }
    }
  }, 500); // Check for attacking every 500 ms
}

createBots().catch(console.error);