import { useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';

import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/PermissionList.css';

type PermissionItem = {
  id: bigint;
  resourceId: string;
  encryptedLevel: string;
  revoked: boolean;
  createdAt: bigint;
  updatedAt: bigint;
  decryptedLevel?: string;
};

const formatHex = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;

const formatDate = (timestamp: bigint) => {
  if (!timestamp) return '—';
  return new Date(Number(timestamp) * 1000).toLocaleString();
};

export function PermissionList() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const signerPromise = useEthersSigner();
  const { instance } = useZamaInstance();

  const [items, setItems] = useState<PermissionItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [decryptingId, setDecryptingId] = useState<bigint | null>(null);
  const [updatingId, setUpdatingId] = useState<bigint | null>(null);
  const [revokingId, setRevokingId] = useState<bigint | null>(null);
  const [levelDrafts, setLevelDrafts] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState('');

  const { data: idData, refetch: refetchIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getOwnerPermissions',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchOnWindowFocus: false,
    },
  });

  const permissionIds = useMemo(() => (idData ? [...idData] : []), [idData]);

  useEffect(() => {
    let cancelled = false;

    const loadPermissions = async () => {
      if (!publicClient || !permissionIds.length) {
        if (!cancelled) {
          setItems([]);
        }
        return;
      }

      setIsFetching(true);
      setErrorMessage('');

      try {
        const contracts = permissionIds.map((id) => ({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getPermission',
          args: [id],
        }));

        const responses = await publicClient.multicall({ contracts });

        const mapped: PermissionItem[] = responses
          .map((response, index) => {
            if (response.status !== 'success' || !Array.isArray(response.result)) {
              return null;
            }
            const result = response.result as unknown[];
            return {
              id: permissionIds[index],
              resourceId: result[0] as string,
              encryptedLevel: result[3] as string,
              revoked: result[4] as boolean,
              createdAt: result[5] as bigint,
              updatedAt: result[6] as bigint,
            } satisfies PermissionItem;
          })
          .filter(Boolean) as PermissionItem[];

        if (!cancelled) {
          setItems(mapped);
          const nextDrafts: Record<string, string> = {};
          mapped.forEach((item) => {
            const key = item.id.toString();
            if (levelDrafts[key] !== undefined) {
              nextDrafts[key] = levelDrafts[key];
            }
          });
          setLevelDrafts(nextDrafts);
        }
      } catch (error) {
        console.error('Failed to load permissions:', error);
        if (!cancelled) {
          setErrorMessage('Unable to fetch permissions from the network.');
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    loadPermissions();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, permissionIds, reloadNonce]);

  const decryptLevel = async (item: PermissionItem) => {
    if (!instance || !address) {
      setErrorMessage('Encryption service is not ready for decryption.');
      return;
    }

    try {
      setDecryptingId(item.id);
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

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer unavailable.');
      }

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const response = await instance.userDecrypt(
        [
          {
            handle: item.encryptedLevel,
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

      const decrypted = response[item.encryptedLevel];
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, decryptedLevel: decrypted ?? '0' } : entry
        )
      );
    } catch (error) {
      console.error('Decryption failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to decrypt level.');
    } finally {
      setDecryptingId(null);
    }
  };

  const updateLevel = async (item: PermissionItem) => {
    if (!instance || !address) {
      setErrorMessage('Encryption service is not ready for updates.');
      return;
    }

    const draftValue = levelDrafts[item.id.toString()];
    const parsed = draftValue ? Number(draftValue) : NaN;

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
      setErrorMessage('Provide a level between 0 and 255 before updating.');
      return;
    }

    try {
      setUpdatingId(item.id);
      const buffer = instance.createEncryptedInput(CONTRACT_ADDRESS, address);
      buffer.add8(BigInt(parsed));
      const encrypted = await buffer.encrypt();

      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer unavailable.');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.updateAccessLevel(
        item.id,
        encrypted.handles[0],
        encrypted.inputProof
      );

      await tx.wait();
      setReloadNonce((value) => value + 1);
      await refetchIds();
      setLevelDrafts((prev) => ({ ...prev, [item.id.toString()]: '' }));
    } catch (error) {
      console.error('Failed to update level:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update level.');
    } finally {
      setUpdatingId(null);
    }
  };

  const revokePermission = async (item: PermissionItem) => {
    try {
      setRevokingId(item.id);
      const signer = await signerPromise;
      if (!signer) {
        throw new Error('Wallet signer unavailable.');
      }

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.revokeAccess(item.id);
      await tx.wait();
      setReloadNonce((value) => value + 1);
      await refetchIds();
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to revoke permission.');
    } finally {
      setRevokingId(null);
    }
  };

  if (!address) {
    return (
      <div className="permission-card muted">
        <p>Please connect your wallet to inspect your encrypted permissions.</p>
      </div>
    );
  }

  if (!permissionIds.length && !isFetching) {
    return (
      <div className="permission-card muted">
        <p>Your account has not issued any encrypted permissions yet.</p>
      </div>
    );
  }

  return (
    <div className="permission-list">
      {errorMessage && <div className="alert error">{errorMessage}</div>}
      {isFetching && <div className="permission-card muted">Loading encrypted entries…</div>}

      {items.map((item) => {
        const key = item.id.toString();
        const draft = levelDrafts[key] ?? '';
        const levelLabel = item.decryptedLevel ?? 'Encrypted';

        return (
          <div className="permission-card" key={key}>
            <header>
              <div>
                <p className="label">Permission #{item.id.toString()}</p>
                <h3>{formatHex(item.resourceId)}</h3>
              </div>
              <div className={`status ${item.revoked ? 'revoked' : 'active'}`}>
                {item.revoked ? 'Revoked' : 'Active'}
              </div>
            </header>

            <dl>
              <div>
                <dt>Current Level</dt>
                <dd>{levelLabel}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(item.createdAt)}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDate(item.updatedAt)}</dd>
              </div>
            </dl>

            <div className="actions">
              <button
                className="ghost"
                disabled={decryptingId === item.id}
                onClick={() => decryptLevel(item)}
              >
                {decryptingId === item.id ? 'Decrypting…' : 'Decrypt Level'}
              </button>

              <div className="inline-form">
                <input
                  type="number"
                  min={0}
                  max={255}
                  placeholder="New level"
                  value={draft}
                  onChange={(event) =>
                    setLevelDrafts((prev) => ({ ...prev, [key]: event.target.value }))
                  }
                />
                <button
                  className="ghost"
                  disabled={updatingId === item.id || item.revoked}
                  onClick={() => updateLevel(item)}
                >
                  {updatingId === item.id ? 'Updating…' : 'Update'}
                </button>
              </div>

              <button
                className="danger"
                disabled={revokingId === item.id || item.revoked}
                onClick={() => revokePermission(item)}
              >
                {revokingId === item.id ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
