param location string = resourceGroup().location
param environmentId string
param identityId string
param identityClientId string
param registryServer string
param image string
param publicOrigin string
param tableEndpoint string
param blobEndpoint string
param visionEndpoint string
@secure()
param visionKey string
@secure()
param bootstrapUsers string

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'nogal'
  location: location
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${identityId}': {} } }
  properties: {
    managedEnvironmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: { external: true, targetPort: 8080, allowInsecure: false, transport: 'auto' }
      registries: [{ server: registryServer, identity: identityId }]
      secrets: [{ name: 'vision-key', value: visionKey }, { name: 'bootstrap-users', value: bootstrapUsers }]
    }
    template: {
      containers: [{
        name: 'nogal'
        image: image
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
        env: [
          { name: 'NODE_ENV', value: 'production' }
          { name: 'HOST', value: '0.0.0.0' }
          { name: 'PORT', value: '8080' }
          { name: 'PUBLIC_ORIGIN', value: publicOrigin }
          { name: 'AZURE_CLIENT_ID', value: identityClientId }
          { name: 'TABLE_ENDPOINT', value: tableEndpoint }
          { name: 'BLOB_ENDPOINT', value: blobEndpoint }
          { name: 'VISION_ENDPOINT', value: visionEndpoint }
          { name: 'VISION_KEY', secretRef: 'vision-key' }
          { name: 'BOOTSTRAP_USERS_JSON', secretRef: 'bootstrap-users' }
        ]
        probes: [{ type: 'Liveness', httpGet: { path: '/api/health', port: 8080, httpHeaders: [{ name: 'Host', value: 'localhost:8080' }] }, initialDelaySeconds: 60, periodSeconds: 30 }]
      }]
      scale: { minReplicas: 0, maxReplicas: 1, rules: [{ name: 'http', http: { metadata: { concurrentRequests: '10' } } }] }
    }
  }
}
output url string = 'https://${app.properties.configuration.ingress.fqdn}'
