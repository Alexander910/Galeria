param location string
param name string
param privateIp string
param subnetId string
param nsgId string
param publicIpId string = ''
param identityId string = ''
param availabilitySetId string = ''
param size string = 'Standard_B1s'
param sshPublicKey string
@secure()
@maxLength(131000)
param initScript string

resource nic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: '${name}-nic'
  location: location
  properties: {
    networkSecurityGroup: { id: nsgId }
    ipConfigurations: [{
      name: 'primary'
      properties: union({
        privateIPAllocationMethod: 'Static'
        privateIPAddress: privateIp
        subnet: { id: subnetId }
      }, empty(publicIpId) ? {} : { publicIPAddress: { id: publicIpId } })
    }]
  }
}
resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: name
  location: location
  tags: { project: 'nogal-cloud-final', role: name, reviewAfter: '2026-11-12', budgetLimitUSD: '50' }
  identity: empty(identityId) ? { type: 'None' } : { type: 'UserAssigned', userAssignedIdentities: { '${identityId}': {} } }
  properties: union({
    hardwareProfile: { vmSize: size }
    securityProfile: { securityType: 'TrustedLaunch', uefiSettings: { secureBootEnabled: true, vTpmEnabled: true } }
    storageProfile: {
      imageReference: { publisher: 'Canonical', offer: '0001-com-ubuntu-server-jammy', sku: '22_04-lts-gen2', version: 'latest' }
      osDisk: { name: '${name}-os', createOption: 'FromImage', diskSizeGB: 30, managedDisk: { storageAccountType: 'Standard_LRS' }, deleteOption: 'Delete' }
    }
    osProfile: {
      computerName: name
      adminUsername: 'nogaladmin'
      linuxConfiguration: {
        disablePasswordAuthentication: true
        provisionVMAgent: true
        ssh: { publicKeys: [{ path: '/home/nogaladmin/.ssh/authorized_keys', keyData: sshPublicKey }] }
      }
    }
    networkProfile: { networkInterfaces: [{ id: nic.id, properties: { deleteOption: 'Delete' } }] }
    diagnosticsProfile: { bootDiagnostics: { enabled: true } }
  }, empty(availabilitySetId) ? {} : { availabilitySet: { id: availabilitySetId } })
}
resource setup 'Microsoft.Compute/virtualMachines/extensions@2024-07-01' = {
  parent: vm
  name: 'nogal-setup'
  location: location
  properties: {
    publisher: 'Microsoft.Azure.Extensions'
    type: 'CustomScript'
    typeHandlerVersion: '2.1'
    autoUpgradeMinorVersion: true
    protectedSettings: { commandToExecute: 'bash <<\'NOGAL_INITIALIZE\'\n${replace(initScript, '\r', '')}\nNOGAL_INITIALIZE' }
  }
}
output vmId string = vm.id
