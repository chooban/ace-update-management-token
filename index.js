/**
 * 1. Get new token
 * 2. Remove secret from service
 * 3. Add new secret
 * 4. Update service again
 */
const request = require('request-promise');
const argv = require('yargs')
  .usage('Usage: $0 -c [client] -s [secret] -k [key] -d [domain] -n [name]')
  .alias('c', 'client')
  .alias('s', 'secret') // Client secrete for auth0
  .alias('d', 'domain')
  .alias('k', 'key') // Key|name of secret to update
  .alias('n', 'name') // Service name
  .demandOption(['c', 's', 'k', 'd', 'n' ])
  .argv;

const updateDocker = require('./lib/update-docker');

const headers = {
  url: `https://${argv.domain}/oauth/token`,
  headers: {
    'Content-type': 'application/json'
  },
  method: 'POST',
  body: JSON.stringify({
    grant_type: "client_credentials",
    client_id: argv.client,
    client_secret: argv.secret,
    audience: `https://${argv.domain}/api/v2/`
  })
};

request(headers)
  .then((resp) => {
    const parsedResponse = JSON.parse(resp);
    const accessToken = parsedResponse.access_token;
    return updateDocker(argv.name, argv.key, accessToken);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });

