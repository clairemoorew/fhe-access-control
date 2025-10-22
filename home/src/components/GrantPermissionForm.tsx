import { useState } from 'react';
import { Contract, isAddress, keccak256, toUtf8Bytes } from 'ethers';
import { useAccount } from 'wagmi';

import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/GrantPermissionForm.css';

const DEFAULT_LEVEL = 1;

export function GrantPermissionForm() {
  const { address } = useAccount();
  const { instance, isLoading: instanceLoading, error: instanceError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [resourceLabel, setResourceLabel] = useState('');
  const [granteeAddress, setGranteeAddress] = useState('');
  const [permissionLevel, setPermissionLevel] = useState<number>(DEFAULT_LEVEL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const resetForm = () => {
    setResourceLabel('');
    setGranteeAddress('');
    setPermissionLevel(DEFAULT_LEVEL);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setTxHash('');

    if (!address) {
      setFormError('Connect your wallet to grant permissions.');
      return;
    }

    if (!instance) {
      setFormError('Encryption service not ready yet.');
      return;
    }

    if (!granteeAddress || !isAddress(granteeAddress)) {
      setFormError('Enter a valid delegate address.');
      return;
    }

    if (!resourceLabel.trim()) {
      setFormError('Provide a resource label to identify the protected data.');
      return;
    }

    if (permissionLevel < 0 || permissionLevel > 255) {
      setFormError('Permission level must be between 0 and 255.');
      return;
    }

    try {
      setIsSubmitting(true);

      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      buffer.addAddress(granteeAddress);
      buffer.add8(BigInt(permissionLevel));

      const encryptedPayload = await buffer.encrypt();
      const signer = await signerPromise;

      if (!signer) {
        throw new Error('No signer available');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const resourceId = keccak256(toUtf8Bytes(resourceLabel.trim()));

      const tx = await contract.grantAccess(
        resourceId,
        encryptedPayload.handles[0],
        encryptedPayload.handles[1],
        encryptedPayload.inputProof
      );

      const receipt = await tx.wait();
      setTxHash(receipt?.hash ?? tx.hash);
      resetForm();
    } catch (error) {
      console.error('Failed to grant permission:', error);
      setFormError(error instanceof Error ? error.message : 'Transaction failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grant-card">
      <header className="grant-header">
        <h2>Grant Encrypted Permission</h2>
        <p>
          Encrypt delegate information locally before publishing, ensuring that only the contract can
          verify the recipient.
        </p>
      </header>

      {instanceError && <div className="alert error">{instanceError}</div>}
      {formError && <div className="alert error">{formError}</div>}
      {txHash && (
        <div className="alert success">
          Permission recorded on-chain.
          <br />
          <span className="mono">Tx: {txHash}</span>
        </div>
      )}

      <form className="grant-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Resource Label</span>
          <input
            type="text"
            placeholder="workspace-alpha"
            value={resourceLabel}
            onChange={(event) => setResourceLabel(event.target.value)}
            disabled={isSubmitting || instanceLoading}
            required
          />
          <small>
            This label stays off-chain; the contract stores its keccak256 hash: <code>keccak256(label)</code>.
          </small>
        </label>

        <label className="field">
          <span>Delegate Address</span>
          <input
            type="text"
            placeholder="0x..."
            value={granteeAddress}
            onChange={(event) => setGranteeAddress(event.target.value)}
            disabled={isSubmitting || instanceLoading}
            required
          />
        </label>

        <label className="field">
          <span>Permission Level</span>
          <input
            type="number"
            min={0}
            max={255}
            value={permissionLevel}
            onChange={(event) => setPermissionLevel(Number(event.target.value))}
            disabled={isSubmitting || instanceLoading}
            required
          />
          <small>Define an application-specific access tier. Values remain encrypted on-chain.</small>
        </label>

        <button type="submit" className="primary" disabled={isSubmitting || instanceLoading}>
          {isSubmitting ? 'Publishing encrypted entry...' : 'Publish Permission'}
        </button>
      </form>
    </div>
  );
}
