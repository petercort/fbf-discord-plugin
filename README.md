<!--
This README is autogenerated. Do not make modifications directly to this file.
Changes should be made to the readme-template.yml file and the generate-readme.js script.
-->

# Event Buddy

A discord plugin that manages _stuff_ in the Fast But Friendly Discord! 

| Command | Inputs | Description | Example | Output |
| ------- | ------ | ----------- | ------- | ------ |
| /connect_strava | None | User authorizes access to the Strava app to collect information about your bikes. Permissions: scope=read, activity:read_all, profile:read_all | /connect_strava | A link to connect to Strava |
| /sync_bikes | None | Syncs bike data from Strava. | /sync_bikes | Returns bike data in the format Name (Brand, Model, Mileage) |
| /get_all_bikes | None | Gets all your bike data from Strava | /get_all_bikes | Returns bike data in the format Name (Brand, Model) | 
| /get_bike_by_name | name | Returns specific details about a bike | /get_bike_by_name name: Joe | Returns more bike data in the format name, brand, model, current mileage, and last waxed (date + mileage) | 
| /i_waxed_my_chain | bike_name (req) date (optional) mileage (optional) | Updated the last_waxed field on the app. With no optional params passed it will update to the current date and mileage. | If successful, returns the date and mileage in the system for a last wax, otherwise returns an error. | 
| /get_last_ride | none | Returns the last ride you did according to Strava | /get_last_ride | Returns info on the last ride you did. |

## Known Issues
- No known issues

## Owner Maintainers
- @petercort
