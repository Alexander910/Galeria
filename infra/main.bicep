param location string = resourceGroup().location
param suffix string = uniqueString(resourceGroup().id)

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'nogal-app-identity'
  location: location
}
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'nogal-20-usd'
  properties: {
    category: 'Cost'
    amount: 20
    timeGrain: 'Annually'
    timePeriod: { startDate: '2026-11-01T00:00:00Z', endDate: '2027-11-01T00:00:00Z' }
  }
}
resource network 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'nogal-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.33.0.0/16'] }
    subnets: [
      { name: 'apps', properties: { addressPrefix: '10.33.0.0/23', delegations: [{ name: 'containerapps', properties: { serviceName: 'Microsoft.App/environments' } }] } }
      { name: 'database', properties: { addressPrefix: '10.33.2.0/24', privateEndpointNetworkPolicies: 'Disabled' } }
    ]
  }
}
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'nogal-environment'
  location: location
  properties: {
    vnetConfiguration: { infrastructureSubnetId: '${network.id}/subnets/apps' }
    workloadProfiles: [{ name: 'Consumption', workloadProfileType: 'Consumption' }]
  }
}
resource tableStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'nogaldb${suffix}'
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: { minimumTlsVersion: 'TLS1_2', supportsHttpsTrafficOnly: true, allowBlobPublicAccess: false, allowSharedKeyAccess: false, publicNetworkAccess: 'Disabled' }
}
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = {
  parent: tableStorage
  name: 'default'
  properties: {}
}
resource tables 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = [for name in ['users', 'sessions', 'artworks']: {
  parent: tableService
  name: name
  properties: {}
}]
resource dns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.table.core.windows.net'
  location: 'global'
}
resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: dns
  name: 'nogal-network'
  location: 'global'
  properties: { registrationEnabled: false, virtualNetwork: { id: network.id } }
}
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'nogal-database-private'
  location: location
  properties: {
    subnet: { id: '${network.id}/subnets/database' }
    privateLinkServiceConnections: [{ name: 'tables', properties: { privateLinkServiceId: tableStorage.id, groupIds: ['table'] } }]
  }
}
resource dnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: { privateDnsZoneConfigs: [{ name: 'tables', properties: { privateDnsZoneId: dns.id } }] }
}
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'nogal${suffix}'
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: { minimumTlsVersion: 'TLS1_2', supportsHttpsTrafficOnly: true, allowBlobPublicAccess: false, allowSharedKeyAccess: false, accessTier: 'Hot' }
}
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: { deleteRetentionPolicy: { enabled: true, days: 7 } }
}
resource images 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'images'
  properties: { publicAccess: 'None' }
}
resource vision 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: 'nogal-vision-${suffix}'
  location: location
  kind: 'ComputerVision'
  sku: { name: 'F0' }
  properties: { customSubDomainName: 'nogal-vision-${suffix}', publicNetworkAccess: 'Enabled' }
}
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: 'nogal${suffix}'
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}
resource blobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(images.id, identity.id, 'blob-data')
  scope: images
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') }
}
resource pullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, identity.id, 'acr-pull')
  scope: registry
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') }
}
resource dataRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(tableStorage.id, identity.id, 'table-data')
  scope: tableStorage
  properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3') }
}
output environmentId string = environment.id
output defaultDomain string = environment.properties.defaultDomain
output identityId string = identity.id
output identityClientId string = identity.properties.clientId
output registryName string = registry.name
output registryServer string = registry.properties.loginServer
output tableEndpoint string = tableStorage.properties.primaryEndpoints.table
output blobEndpoint string = storage.properties.primaryEndpoints.blob
output visionEndpoint string = vision.properties.endpoint
output visionName string = vision.name
