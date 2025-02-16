const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { EventsTable, UsersTable, BikesTable } = require('./dbObjects.js');
require('dotenv').config();

// load configs 
let discordToken;

if (process.env.NODE_ENV === 'production'){ 
	discordToken = fs.readFileSync("/mnt/secrets-store/discordToken", 'utf8');
} else { 
	discordToken = process.env.discordToken
}

// Create the discord client and instantiate the commands collection
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// manage the sequelize connection
client.once(Events.ClientReady, readyClient => {
	console.log('Syncing database...');
	EventsTable.sync({ alter: true });
	//UsersTable.sync({ alter: true, force: true });
	UsersTable.sync();
	//BikesTable.sync({ alter: true, force: true });
	BikesTable.sync();
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

// Start the Strava webhook server
require('./strava_webhook.js');

client.login(discordToken);
