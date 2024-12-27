const express = require('express');
const { UsersTable, BikesTable } = require('./dbObjects.js'); 
const axios = require('axios');
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds]  });
const fs = require('node:fs');
const { firstTimeAuth, getStravaAuthentication } = require('./shared_library/strava_authentication.js');
const app = express();
app.use(express.json());
const discordToken = fs.readFileSync("/mnt/secrets-store/discordToken", 'utf8');
client.login(discordToken);

app.post('/webhook', async (req, res) => {
    console.log("webhook event received!", req.body);
    // get the object_id and owner id 
    // call the strava API to get the activity details
    // from the activity details get the athlete ID, distance, and gear id 
    // update the database with the new distance and do a calculation to see if they need to wax their chain
    // if they do send a message to the discord user
    const event = req.body;
    
    if (event.object_type === 'activity' && event.aspect_type === 'create') {
        const user = await UsersTable.findOne({ where: { strava_user_id: event.owner_id } });
        if (user) {
            const stravaAccessToken = await getStravaAuthentication(user.dataValues)
            try {
                const rideData = await axios.get(`https://www.strava.com/api/v3/activities/${event.object_id}`, {
                    headers: { Authorization: `Bearer ${stravaAccessToken}` }
                });
                const gearId = rideData.data.gear.id;
                const currentDistance = rideData.data.gear.distance;
                // update the distance for the gear
                await syncBike(gearId, currentDistance, user.dataValues.userId);
                const lastWaxedDistance = await getLastWaxed(gearId, user.dataValues.userId);
            
                const totalMiles = Math.round(currentDistance * 0.000621371);
                const lastWaxedMiles = Math.round(lastWaxedDistance * 0.000621371);
                const currentDiff = totalMiles - lastWaxedMiles;
                if (currentDiff > 250) {
                    const message = `Nice ride and it's time to wax your chain! You've ridden ${currentDiff} miles since your last wax.`
                    const id = user.dataValues.userId;
                    const discordUser = await client.users.fetch(id)
                    discordUser.send(message);
                } else if (currentDiff > 150) {    
                    const message = `Nice ride! You're getting close to needing to wax your chain. You've ridden ${currentDiff} miles since your last wax.`;
                    const id = user.dataValues.userId;
                    const discordUser = await client.users.fetch(id)
                    discordUser.send(message);
                }
                console.log(`Updated distance for gear ${gearId} to ${Math.round(currentDistance * 0.000621371)}`);
            } catch (error) {
                console.error('Error fetching ride data:', error);
            }
        } else {
            console.log('No user found for strava user id:', event.owner_id);
        }
    }
    res.sendStatus(200);
  });

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {
    // Your verify token. Should be a random string.
    const VERIFY_TOKEN = "STRAVA";
    // Parses the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];
    // Checks if a token and mode is in the query string of the request
    if (mode && token) {
      // Verifies that the mode and token sent are valid
      if (mode === 'subscribe' && token === VERIFY_TOKEN) {     
        // Responds with the challenge token from the request
        console.log('WEBHOOK_VERIFIED');
        res.json({"hub.challenge":challenge});  
      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.sendStatus(403);      
      }
    }
  });

app.get('/strava/callback/:userId', async (req, res) => {
    const code = req.query.code;
    const userId = req.params.userId;
    if (!code) {
        return res.status(400).send('Missing authorization code');
    }
    const { athlete_id, strava_access_token } = await firstTimeAuth(userId, code);
    console.log('added strava athlete : ', athlete_id, 'for discord user:' , userId);
    await setupBikes(athlete_id, userId, strava_access_token)
    
    return res.send('Strava account connected successfully!');
});

app.listen(3000, () => {
    console.log('Strava webhook server is running on port 3000');
});


async function setupBikes(athleteId, userId, strava_access_token) {
    // Fetch the user's bikes from Strava's /athletes endpoint
    try {
        const athleteResponse = await axios.get(`https://www.strava.com/api/v3/athletes/${athleteId}`, {
            headers: { Authorization: `Bearer ${strava_access_token}` }
        });
        // get the athlete page 
        // Fetch details for each bike from Strava's /gear endpoint and update the database
        for (const bike of athleteResponse.data.bikes) {
            // Update the database with the bike details
            await BikesTable.upsert({
                bikeId: bike.id,
                userId: userId,
                name: bike.name,
                brand: bike.brand_name,
                model: bike.model_name,
                distance: bike.distance
            });
        }
    } catch (error) {
        console.error('Error fetching athlete data:', error.status, error.message);
    }
}

async function syncBike(bikeId, distance, userId) {
    try {
        await BikesTable.update(
            { distance },
            { where: { bikeId, userId },
            returning: true,
            plain: true}
        );
        
    } catch (error) {
        console.error('Error updating data:', error);
    }
}

async function getLastWaxed(bikeId, userId){
    try {
        const output = await BikesTable.findOne({ where: { bikeId, userId } });
        return output.dataValues.lastWaxedDistance;
    } catch (error) {
        console.error('Error finding data:', error);
    }

}