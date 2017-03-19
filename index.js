/**
 * 1. Get new token
 * 2. Remove secret from service
 * 3. Add new secret
 * 4. Update service again
 */
const request = require('request-promise');
const Promise = require('bluebird');
const argv = require('yargs')
  .usage('Usage: $0 -c [client] -s [secret] -k [key] -d [domain] -n [name]')
  .alias('c', 'client')
  .alias('s', 'secret') // Client secrete for auth0
  .alias('d', 'domain')
  .alias('k', 'key') // Key|name of secret to update
  .alias('n', 'name') // Service name
  .demandOption(['c', 's', 'k', 'd', 'n' ])
  .argv;

const DockerOps = require('./lib/update-docker');

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
    const service = DockerOps.getService(argv.name);
    const secret = DockerOps.getSecret(argv.key);

    return Promise.join(service, secret, (serviceObj, secretObj) => ({
      service: serviceObj,
      secret: secretObj,
      accessToken
    }));
  })
  .then((results) => {
    const removeSecret = DockerOps.removeSecretFromService(argv.key, results.service);
    return removeSecret.then(() => results)
  })
  .then((results) =>
    results.secret.remove()
      .then(() => ({
        accessToken: results.accessToken,
        service: results.service
      }))
  )
  .then((results) =>
    DockerOps.createSecret(argv.key, results.accessToken)
      .then((secret) => Object.assign({}, results, { secret }))
  )
  .then((results) => DockerOps.addSecretToService(results.service, results.secret))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });

