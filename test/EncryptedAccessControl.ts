import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { EncryptedAccessControl, EncryptedAccessControl__factory } from "../types";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  owner: HardhatEthersSigner;
  delegate: HardhatEthersSigner;
  outsider: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("EncryptedAccessControl")) as EncryptedAccessControl__factory;
  const contract = (await factory.deploy()) as EncryptedAccessControl;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("EncryptedAccessControl", function () {
  let signers: Signers;
  let contract: EncryptedAccessControl;
  let contractAddress: string;

  before(async function () {
    const [owner, delegate, outsider] = await ethers.getSigners();
    signers = { owner, delegate, outsider };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("grants and reads encrypted permission", async function () {
    const resourceId = ethers.keccak256(ethers.toUtf8Bytes("document-1"));

    const encryptedInputs = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .addAddress(signers.delegate.address)
      .add8(3)
      .encrypt();

    const tx = await contract
      .connect(signers.owner)
      .grantAccess(resourceId, encryptedInputs.handles[0], encryptedInputs.handles[1], encryptedInputs.inputProof);
    await tx.wait();

    const [resource, owner, , encryptedLevel, revoked] = await contract.getPermission(1);

    expect(resource).to.equal(resourceId);
    expect(owner).to.equal(signers.owner.address);
    expect(revoked).to.equal(false);

    const decryptedLevel = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedLevel,
      contractAddress,
      signers.owner,
    );
    expect(decryptedLevel).to.equal(3);
  });

  it("evaluates permission for delegate and outsider", async function () {
    const resourceId = ethers.keccak256(ethers.toUtf8Bytes("workspace"));

    const ownerBuffer = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .addAddress(signers.delegate.address)
      .add8(1)
      .encrypt();

    await contract
      .connect(signers.owner)
      .grantAccess(resourceId, ownerBuffer.handles[0], ownerBuffer.handles[1], ownerBuffer.inputProof);

    const delegateBuffer = await fhevm
      .createEncryptedInput(contractAddress, signers.delegate.address)
      .addAddress(signers.delegate.address)
      .encrypt();

    const delegateTx = await contract
      .connect(signers.delegate)
      .evaluatePermission(1, delegateBuffer.handles[0], delegateBuffer.inputProof);
    await delegateTx.wait();

    const delegateResult = await contract.getEvaluationResult(1, signers.delegate.address);

    const delegatePlain = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      delegateResult,
      contractAddress,
      signers.delegate,
    );
    expect(delegatePlain).to.equal(1);

    const outsiderBuffer = await fhevm
      .createEncryptedInput(contractAddress, signers.outsider.address)
      .addAddress(signers.outsider.address)
      .encrypt();

    const outsiderTx = await contract
      .connect(signers.outsider)
      .evaluatePermission(1, outsiderBuffer.handles[0], outsiderBuffer.inputProof);
    await outsiderTx.wait();

    const outsiderResult = await contract.getEvaluationResult(1, signers.outsider.address);

    const outsiderPlain = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      outsiderResult,
      contractAddress,
      signers.outsider,
    );
    expect(outsiderPlain).to.equal(0);
  });

  it("updates and revokes a permission", async function () {
    const resourceId = ethers.keccak256(ethers.toUtf8Bytes("dataset"));

    const ownerBuffer = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .addAddress(signers.delegate.address)
      .add8(1)
      .encrypt();

    await contract
      .connect(signers.owner)
      .grantAccess(resourceId, ownerBuffer.handles[0], ownerBuffer.handles[1], ownerBuffer.inputProof);

    const newLevelBuffer = await fhevm
      .createEncryptedInput(contractAddress, signers.owner.address)
      .add8(7)
      .encrypt();

    const updateTx = await contract
      .connect(signers.owner)
      .updateAccessLevel(1, newLevelBuffer.handles[0], newLevelBuffer.inputProof);
    await updateTx.wait();

    const [, , , encryptedLevel] = await contract.getPermission(1);
    const updatedLevel = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedLevel,
      contractAddress,
      signers.owner,
    );
    expect(updatedLevel).to.equal(7);

    const revokeTx = await contract.connect(signers.owner).revokeAccess(1);
    await revokeTx.wait();

    const [, , , , revoked] = await contract.getPermission(1);
    expect(revoked).to.equal(true);

    const outsiderBuffer = await fhevm
      .createEncryptedInput(contractAddress, signers.outsider.address)
      .addAddress(signers.outsider.address)
      .encrypt();

    await expect(
      contract
        .connect(signers.outsider)
        .evaluatePermission(1, outsiderBuffer.handles[0], outsiderBuffer.inputProof),
    ).to.be.revertedWithCustomError(contract, "PermissionRevokedAlready");
  });
});
