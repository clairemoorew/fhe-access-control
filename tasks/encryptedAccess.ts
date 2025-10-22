import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

const CONTRACT_NAME = "EncryptedAccessControl";

task("access:address", "Prints the contract address").setAction(async (_args: TaskArguments, hre) => {
  const deployment = await hre.deployments.get(CONTRACT_NAME);
  console.log(`${CONTRACT_NAME} address: ${deployment.address}`);
});

task("access:grant", "Creates an encrypted permission entry")
  .addParam("resource", "Resource identifier (string will be hashed on-chain)")
  .addParam("grantee", "Target address in hex")
  .addParam("level", "Permission level (0-255)")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;

    const deployment = await deployments.get(CONTRACT_NAME);
    const [signer] = await ethers.getSigners();

    await fhevm.initializeCLIApi();

    const buffer = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .addAddress(args.grantee)
      .add8(parseInt(args.level, 10))
      .encrypt();

    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const tx = await contract
      .connect(signer)
      .grantAccess(
        ethers.keccak256(ethers.toUtf8Bytes(args.resource)),
        buffer.handles[0],
        buffer.handles[1],
        buffer.inputProof,
      );
    console.log(`Submitted tx: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Status: ${receipt?.status}`);
  });

task("access:get", "Reads a permission entry")
  .addParam("id", "Permission id")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const deployment = await deployments.get(CONTRACT_NAME);
    const contract = await ethers.getContractAt(CONTRACT_NAME, deployment.address);

    const result = await contract.getPermission(BigInt(args.id));
    console.log(result);
  });
