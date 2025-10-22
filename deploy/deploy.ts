import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedAccessControl = await deploy("EncryptedAccessControl", {
    from: deployer,
    log: true,
  });

  console.log(`EncryptedAccessControl contract: `, deployedAccessControl.address);
};
export default func;
func.id = "deploy_encrypted_access_control"; // id required to prevent reexecution
func.tags = ["EncryptedAccessControl"];
