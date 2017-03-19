const Promise = require('bluebird');
const Docker = require('dockerode');

const getService = (serviceName) => (
  new Docker().listServices()
    .then((services) => {
      const id = services.find((s) => {
        return s.Spec.Name === serviceName;
      });
      if (!id) throw new Error('No service found');

      return id.ID;
    })
    .then((id) => new Docker().getService(id))
);

const getSecret = (secretName) => (
  new Docker().listSecrets()
    .then((secrets) => {
      const id = secrets.find((s) => {
        return s.Spec.Name === secretName;
      });
      if (!id) throw new Error('No secret found');

      return id.ID;
    })
    .then((id) => new Docker().getSecret(id))
);

const removeSecretFromService = (secretName, service) => (
  service.inspect()
    .then((s) => {
      const currentSecrets = s.Spec.TaskTemplate.ContainerSpec.Secrets;
      const newSecrets = currentSecrets.filter(
        (sec) => sec.SecretName !== secretName
      );

      s.Spec.TaskTemplate.ContainerSpec.Secrets = newSecrets;

      const opts = Object.assign({}, s.Spec, {
        version: parseInt(s.Version.Index)
      });
      return service.update(undefined, opts);
    })
);

const createSecret = (secretName, value) => (
  new Docker().createSecret({
        Name: secretName,
        Data: Buffer.from(value).toString('base64')
  })
  .then(s => s.inspect())
);

const addSecretToService = (service, secret) => {
  return service.inspect()
    .then(s => {
      const newSecrets = s.Spec.TaskTemplate.ContainerSpec.Secrets.slice(0);
      newSecrets.push({
        SecretID: secret.ID,
        SecretName: secret.Spec.Name,
        File: {
          Name: secret.Spec.Name,
          UID: '0',
          GID: '0',
          Mode: 292
        }
      });
      const opts = Object.assign({},
        s.Spec,
        { version: parseInt(s.Version.Index) }
      );
      opts.TaskTemplate.ContainerSpec.Secrets = newSecrets;
      return service.update(undefined, opts);
    });
};

module.exports = {
  getSecret,
  getService,
  createSecret,
  removeSecretFromService,
  addSecretToService
};
