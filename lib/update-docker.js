const Promise = require('bluebird');
const Docker = require('dockerode');

module.exports = function(serviceName, secretName, value) {
  const docker = new Docker();

  const serviceId = docker.listServices()
    .then((services) => {
      const id = services.find((s) => {
        return s.Spec.Name === serviceName;
      });
      if (!id) throw new Error('No service found');

      return id.ID;
    })
    .then((id) => docker.getService(id));

  const secretId = docker.listSecrets()
    .then((secrets) => {
      const id = secrets.find((s) => {
        return s.Spec.Name === secretName;
      });
      if (!id) throw new Error('No secret found');

      return id.ID;
    })
    .then((id) => docker.getSecret(id));

  const createNewSecret = Promise.join(serviceId, secretId, (service, secret) => {
    return service.inspect()
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
      .then(() => secret.remove())
      .then(() => docker.createSecret({
        "Name": secretName,
        "Data": Buffer.from(value).toString('base64')
      }))
      .then(s => s.inspect());
  });

  return Promise.join(serviceId, createNewSecret, (service, secret) => {
    return service.inspect()
      .then(s => {
        const newSecrets = s.Spec.TaskTemplate.ContainerSpec.Secrets.slice(0);
        newSecrets.push({
          SecretID: secret.ID,
          SecretName: secret.Spec.Name
        });
        const opts = Object.assign({},
          s.Spec,
          { version: parseInt(s.Version.Index) }
        );

        opts.TaskTemplate.ContainerSpec.Secrets = newSecrets;

        console.log("Updating to", JSON.stringify(opts, null, 2));
        return service.update(undefined, opts);
      });
  });
};
