param location string = 'northcentralus'
param recoveryLocation string = 'belgiumcentral'
param visionLocation string = 'canadacentral'
param suffix string = uniqueString(resourceGroup().id)
param appVmSize string = 'Standard_B2ats_v2'
param proxyVmSize string = 'Standard_B2ats_v2'
param opsVmSize string = 'Standard_B2ats_v2'
param sshPublicKey string
@secure()
param bootstrapUsers string

var tags = { project: 'nogal-cloud-final', reviewAfter: '2026-11-12', budgetLimitUSD: '50' }
var appRole = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3')
var blobWriter = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
var blobReader = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1')
var tableReader = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '76199698-9eea-4c19-bc75-cec21354c6b6')
resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = { name: 'nogal-app-identity', location: location, tags: tags }
resource opsIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = { name: 'nogal-backup-identity', location: location, tags: tags }
resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'nogal-50-usd'
  properties: { category: 'Cost', amount: 50, timeGrain: 'Annually', timePeriod: { startDate: '2026-11-01T00:00:00Z', endDate: '2027-11-01T00:00:00Z' } }
}
resource natIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: 'nogal-egress-ip'
  location: location
  sku: { name: 'Standard' }
  properties: { publicIPAllocationMethod: 'Static' }
}
resource nat 'Microsoft.Network/natGateways@2024-05-01' = {
  name: 'nogal-egress'
  location: location
  sku: { name: 'Standard' }
  properties: { publicIpAddresses: [{ id: natIp.id }], idleTimeoutInMinutes: 4 }
}
resource network 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'nogal-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: ['10.44.0.0/16'] }
    subnets: [
      { name: 'edge', properties: { addressPrefix: '10.44.1.0/24' } }
      { name: 'apps', properties: { addressPrefix: '10.44.2.0/24', natGateway: { id: nat.id }, serviceEndpoints: [{ service: 'Microsoft.KeyVault' }] } }
      { name: 'database', properties: { addressPrefix: '10.44.3.0/24', privateEndpointNetworkPolicies: 'Disabled' } }
    ]
  }
}
resource recoveryNatIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: 'nogal-recovery-egress-ip'
  location: recoveryLocation
  sku: { name: 'Standard' }
  properties: { publicIPAllocationMethod: 'Static' }
}
resource recoveryNat 'Microsoft.Network/natGateways@2024-05-01' = {
  name: 'nogal-recovery-egress'
  location: recoveryLocation
  sku: { name: 'Standard' }
  properties: { publicIpAddresses: [{ id: recoveryNatIp.id }], idleTimeoutInMinutes: 4 }
}
resource recoveryNetwork 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: 'nogal-recovery-vnet'
  location: recoveryLocation
  properties: {
    addressSpace: { addressPrefixes: ['10.45.0.0/16'] }
    subnets: [
      { name: 'edge', properties: { addressPrefix: '10.45.1.0/24' } }
      { name: 'apps', properties: { addressPrefix: '10.45.2.0/24', natGateway: { id: recoveryNat.id } } }
    ]
  }
}
resource primaryPeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2024-05-01' = {
  parent: network
  name: 'to-recovery'
  properties: { remoteVirtualNetwork: { id: recoveryNetwork.id }, allowVirtualNetworkAccess: true, allowForwardedTraffic: false, allowGatewayTransit: false, useRemoteGateways: false }
}
resource recoveryPeering 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2024-05-01' = {
  parent: recoveryNetwork
  name: 'to-primary'
  properties: { remoteVirtualNetwork: { id: network.id }, allowVirtualNetworkAccess: true, allowForwardedTraffic: false, allowGatewayTransit: false, useRemoteGateways: false }
}
resource recoveryEdgeNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nogal-recovery-edge-nsg'
  location: recoveryLocation
  properties: { securityRules: [
    { name: 'PublicWeb', properties: { priority: 100, direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourcePortRange: '*', destinationPortRanges: ['80', '443'], sourceAddressPrefix: 'Internet', destinationAddressPrefix: '*' } }
    { name: 'DenyOtherInbound', properties: { priority: 4000, direction: 'Inbound', access: 'Deny', protocol: '*', sourcePortRange: '*', destinationPortRange: '*', sourceAddressPrefix: '*', destinationAddressPrefix: '*' } }
  ] }
}
resource edgeNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nogal-edge-nsg'
  location: location
  properties: { securityRules: [
    { name: 'PublicWeb', properties: { priority: 100, direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourcePortRange: '*', destinationPortRanges: ['80', '443'], sourceAddressPrefix: 'Internet', destinationAddressPrefix: '*' } }
    { name: 'DenyOtherInbound', properties: { priority: 4000, direction: 'Inbound', access: 'Deny', protocol: '*', sourcePortRange: '*', destinationPortRange: '*', sourceAddressPrefix: '*', destinationAddressPrefix: '*' } }
  ] }
}
resource appNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nogal-app-nsg'
  location: location
  properties: { securityRules: [
    { name: 'HAProxyToApp', properties: { priority: 100, direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourcePortRange: '*', destinationPortRange: '8080', sourceAddressPrefixes: ['10.44.1.0/24', '10.45.1.0/24'], destinationAddressPrefix: '*' } }
    { name: 'OperationsHealthCheck', properties: { priority: 110, direction: 'Inbound', access: 'Allow', protocol: 'Tcp', sourcePortRange: '*', destinationPortRange: '8080', sourceAddressPrefix: '10.45.2.20', destinationAddressPrefix: '*' } }
    { name: 'DenyOtherInbound', properties: { priority: 4000, direction: 'Inbound', access: 'Deny', protocol: '*', sourcePortRange: '*', destinationPortRange: '*', sourceAddressPrefix: '*', destinationAddressPrefix: '*' } }
  ] }
}
resource opsNsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: 'nogal-ops-nsg'
  location: recoveryLocation
  properties: { securityRules: [{ name: 'DenyInbound', properties: { priority: 4000, direction: 'Inbound', access: 'Deny', protocol: '*', sourcePortRange: '*', destinationPortRange: '*', sourceAddressPrefix: '*', destinationAddressPrefix: '*' } }] }
}
resource appSet 'Microsoft.Compute/availabilitySets@2024-07-01' = {
  name: 'nogal-app-availability'
  location: location
  sku: { name: 'Aligned' }
  properties: { platformFaultDomainCount: 2, platformUpdateDomainCount: 2 }
}
resource publicIps 'Microsoft.Network/publicIPAddresses@2024-05-01' = [for number in range(1, 2): {
  name: 'nogal-proxy-${number}-ip'
  location: number == 1 ? location : recoveryLocation
  sku: { name: 'Standard' }
  properties: { publicIPAllocationMethod: 'Static', dnsSettings: { domainNameLabel: 'nogal-${suffix}-${number}' } }
}]
resource dataStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'nogaldb${suffix}'
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: { minimumTlsVersion: 'TLS1_2', supportsHttpsTrafficOnly: true, allowBlobPublicAccess: false, allowSharedKeyAccess: false, publicNetworkAccess: 'Disabled' }
}
resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' = { parent: dataStorage, name: 'default', properties: {} }
resource tables 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-05-01' = [for name in ['users', 'sessions', 'artworks']: { parent: tableService, name: name, properties: {} }]
resource dns 'Microsoft.Network/privateDnsZones@2024-06-01' = { name: 'privatelink.table.core.windows.net', location: 'global' }
resource dnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = { parent: dns, name: 'nogal-vnet', location: 'global', properties: { registrationEnabled: false, virtualNetwork: { id: network.id } } }
resource recoveryDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = { parent: dns, name: 'nogal-recovery-vnet', location: 'global', properties: { registrationEnabled: false, virtualNetwork: { id: recoveryNetwork.id } } }
resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: 'nogal-database-private'
  location: location
  properties: { subnet: { id: '${network.id}/subnets/database' }, privateLinkServiceConnections: [{ name: 'tables', properties: { privateLinkServiceId: dataStorage.id, groupIds: ['table'] } }] }
}
resource dnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = { parent: privateEndpoint, name: 'default', properties: { privateDnsZoneConfigs: [{ name: 'tables', properties: { privateDnsZoneId: dns.id } }] } }
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'nogal${suffix}'
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: { minimumTlsVersion: 'TLS1_2', supportsHttpsTrafficOnly: true, allowBlobPublicAccess: false, allowSharedKeyAccess: false, accessTier: 'Hot' }
}
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = { parent: storage, name: 'default', properties: { deleteRetentionPolicy: { enabled: true, days: 7 } } }
resource images 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = { parent: blobService, name: 'images', properties: { publicAccess: 'None' } }
resource backups 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = { parent: blobService, name: 'backups', properties: { publicAccess: 'None' } }
resource vision 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: 'nogal-vision-${suffix}'
  location: visionLocation
  kind: 'ComputerVision'
  sku: { name: 'S1' }
  properties: { customSubDomainName: 'nogal-vision-${suffix}', publicNetworkAccess: 'Enabled', disableLocalAuth: true }
}
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'nogal-kv-${suffix}'
  location: location
  properties: {
    tenantId: tenant().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    networkAcls: { defaultAction: 'Deny', bypass: 'AzureServices', virtualNetworkRules: [{ id: '${network.id}/subnets/apps' }] }
  }
}
resource bootstrap 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = { parent: vault, name: 'bootstrap-users', properties: { value: bootstrapUsers } }
resource appTablesRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(dataStorage.id, identity.id, 'app-tables'), scope: dataStorage, properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: appRole } }
resource appBlobRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(images.id, identity.id, 'app-images'), scope: images, properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: blobWriter } }
resource appVisionRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(vision.id, identity.id, 'app-vision'), scope: vision, properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'a97b65f3-24c7-4388-baec-2e87135dc908') } }
resource appSecretRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(vault.id, identity.id, 'app-bootstrap'), scope: vault, properties: { principalId: identity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6') } }
resource opsTablesRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(dataStorage.id, opsIdentity.id, 'backup-tables'), scope: dataStorage, properties: { principalId: opsIdentity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: tableReader } }
resource opsReadRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(images.id, opsIdentity.id, 'backup-images'), scope: images, properties: { principalId: opsIdentity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: blobReader } }
resource opsWriteRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = { name: guid(backups.id, opsIdentity.id, 'backup-write'), scope: backups, properties: { principalId: opsIdentity.properties.principalId, principalType: 'ServicePrincipal', roleDefinitionId: blobWriter } }
var primaryOrigin = 'https://${publicIps[0].properties.dnsSettings.fqdn}'
var secondaryOrigin = 'https://${publicIps[1].properties.dnsSettings.fqdn}'
var commonTokens = {
  '__PRIMARY_ORIGIN__': primaryOrigin
  '__SECONDARY_ORIGIN__': secondaryOrigin
  '__TABLE_ENDPOINT__': dataStorage.properties.primaryEndpoints.table
  '__BLOB_ENDPOINT__': storage.properties.primaryEndpoints.blob
  '__VISION_ENDPOINT__': vision.properties.endpoint
  '__BOOTSTRAP_SECRET_URI__': '${vault.properties.vaultUri}secrets/bootstrap-users'
}
var baseInit = reduce(items(commonTokens), loadTextContent('../../data/deploy/app-init.sh'), (script, token) => replace(script, token.key, token.value))
module apps 'server.bicep' = [for index in range(0, 2): {
  name: 'nogal-app-${index + 1}-deployment'
  params: {
    name: 'nogal-app-${index + 1}'
    location: location
    privateIp: '10.44.2.${10 + index}'
    subnetId: '${network.id}/subnets/apps'
    nsgId: appNsg.id
    availabilitySetId: appSet.id
    size: appVmSize
    sshPublicKey: sshPublicKey
    identityId: identity.id
    initScript: replace(replace(replace(baseInit, '__IDENTITY_CLIENT_ID__', identity.properties.clientId), '__INSTANCE_NAME__', 'nogal-app-${index + 1}'), '__NODE_ROLE__', 'app')
  }
  dependsOn: [appTablesRole, appBlobRole, appVisionRole, appSecretRole, bootstrap, tables, dnsGroup, dnsLink]
}]
module proxies 'server.bicep' = [for index in range(0, 2): {
  name: 'nogal-proxy-${index + 1}-deployment'
  params: {
    name: 'nogal-proxy-${index + 1}'
    location: index == 0 ? location : recoveryLocation
    privateIp: index == 0 ? '10.44.1.10' : '10.45.1.10'
    subnetId: index == 0 ? '${network.id}/subnets/edge' : '${recoveryNetwork.id}/subnets/edge'
    nsgId: index == 0 ? edgeNsg.id : recoveryEdgeNsg.id
    publicIpId: publicIps[index].id
    size: proxyVmSize
    sshPublicKey: sshPublicKey
    initScript: replace(loadTextContent('proxy-init.sh'), '__PUBLIC_HOST__', publicIps[index].properties.dnsSettings.fqdn)
  }
}]
module operations 'server.bicep' = {
  name: 'nogal-ops-deployment'
  params: {
    name: 'nogal-ops'
    location: recoveryLocation
    privateIp: '10.45.2.20'
    subnetId: '${recoveryNetwork.id}/subnets/apps'
    nsgId: opsNsg.id
    size: opsVmSize
    sshPublicKey: sshPublicKey
    identityId: opsIdentity.id
    initScript: replace(replace(replace(baseInit, '__IDENTITY_CLIENT_ID__', opsIdentity.properties.clientId), '__INSTANCE_NAME__', 'nogal-ops'), '__NODE_ROLE__', 'backup')
  }
  dependsOn: [opsTablesRole, opsReadRole, opsWriteRole, tables, dnsGroup, recoveryDnsLink, primaryPeering, recoveryPeering]
}
output primaryUrl string = primaryOrigin
output recoveryUrl string = secondaryOrigin
output vmNames array = ['nogal-proxy-1', 'nogal-proxy-2', 'nogal-app-1', 'nogal-app-2', 'nogal-ops']
output tableEndpoint string = dataStorage.properties.primaryEndpoints.table
output blobEndpoint string = storage.properties.primaryEndpoints.blob
output visionName string = vision.name
