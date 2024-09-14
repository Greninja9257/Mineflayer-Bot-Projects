const mineflayer = require('mineflayer');
const readline = require('readline');
const mcping = require('mc-ping-updated');

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

        bot.once('spawn', () => {
          console.log(`Bot ${username} has spawned!`);
          bots.push(bot);
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

  console.log(`All ${bots.length} bots have been spawned.`);
  rl.close();

  // Keep the script running
  process.stdin.resume();
}

createBots().catch(console.error);
