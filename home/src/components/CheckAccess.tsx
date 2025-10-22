import { useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient } from 'wagmi';

import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/CheckAccess.css';

export function CheckAccess() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { instance } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [permissionId, setPermissionId] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleCheck = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage('');
    setErrorMessage('');

    if (!address) {
      setErrorMessage('Connect your wallet to request an access check.');
      return;
    }

    if (!instance) {
      setErrorMessage('Encryption service not ready for evaluation.');
      return;
    }

    if (!permissionId.trim()) {
      setErrorMessage('Enter a permission identifier to evaluate.');
      return;
    }

    try {
      setIsProcessing(true);

      const permissionKey = BigInt(permissionId.trim());
      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      buffer.addAddress(address);
      const encryptedPayload = await buffer.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer unavailable.');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.evaluatePermission(
        permissionKey,
        encryptedPayload.handles[0],
        encryptedPayload.inputProof
      );
      await tx.wait();

      if (!publicClient) {
        throw new Error('Public RPC client unavailable.');
      }

      const evaluationHandle = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getEvaluationResult',
        args: [permissionKey, address],
      });

      const keypair = instance.generateKeypair();
      const contractAddresses = [CONTRACT_ADDRESS];
      const startTimestamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';

      const eip712 = instance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );

      const signature = await (await signerPromise)!.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const decrypted = await instance.userDecrypt(
        [
          {
            handle: evaluationHandle as string,
            contractAddress: CONTRACT_ADDRESS,
          },
        ],
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimestamp,
        durationDays
      );

      const flag = decrypted[evaluationHandle as string];
      setStatusMessage(flag === '1' ? 'Access granted to this permission.' : 'Access not granted.');
    } catch (error) {
      console.error('Access check failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to evaluate permission.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="check-card">
      <header>
        <h2>Verify Your Access</h2>
        <p>Encrypt your wallet address with the relayer, then let the contract confirm the match privately.</p>
      </header>

      <form onSubmit={handleCheck} className="check-form">
        <label>
          <span>Permission Identifier</span>
          <input
            type="number"
            min={1}
            placeholder="e.g. 1"
            value={permissionId}
            onChange={(event) => setPermissionId(event.target.value)}
            disabled={isProcessing}
            required
          />
        </label>

        <button type="submit" disabled={isProcessing}>
          {isProcessing ? 'Submitting encrypted request…' : 'Request Evaluation'}
        </button>
      </form>

      {statusMessage && <div className="notice success">{statusMessage}</div>}
      {errorMessage && <div className="notice error">{errorMessage}</div>}
    </div>
  );
}
