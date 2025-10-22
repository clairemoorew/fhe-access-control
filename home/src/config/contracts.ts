const resolvedAddress = (import.meta.env.VITE_CONTRACT_ADDRESS as `0x${string}` | undefined)?.toLowerCase() as
  | `0x${string}`
  | undefined;

export const CONTRACT_ADDRESS: `0x${string}` =
  resolvedAddress ?? '0x5Cf01f112cba405CbEE799F2a8a1C25Ac026B743';

export const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "caller",
        "type": "address"
      }
    ],
    "name": "NotPermissionOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      }
    ],
    "name": "PermissionNotFound",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      }
    ],
    "name": "PermissionRevokedAlready",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "requester",
        "type": "address"
      }
    ],
    "name": "PermissionEvaluated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "resourceId",
        "type": "bytes32"
      }
    ],
    "name": "PermissionGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "PermissionLevelUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "PermissionRevoked",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "resourceId",
        "type": "bytes32"
      },
      {
        "internalType": "externalEaddress",
        "name": "encryptedGrantee",
        "type": "bytes32"
      },
      {
        "internalType": "externalEuint8",
        "name": "encryptedLevel",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "grantAccess",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "requester",
        "type": "address"
      }
    ],
    "name": "getEvaluationResult",
    "outputs": [
      {
        "internalType": "euint8",
        "name": "result",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      }
    ],
    "name": "getPermission",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "resourceId",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      },
      {
        "internalType": "eaddress",
        "name": "encryptedGrantee",
        "type": "bytes"
      },
      {
        "internalType": "euint8",
        "name": "encryptedLevel",
        "type": "bytes32"
      },
      {
        "internalType": "bool",
        "name": "revoked",
        "type": "bool"
      },
      {
        "internalType": "uint256",
        "name": "createdAt",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "updatedAt",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "getOwnerPermissions",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "ids",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "resourceId",
        "type": "bytes32"
      }
    ],
    "name": "getResourcePermissions",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "ids",
        "type": "uint256[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      },
      {
        "internalType": "externalEaddress",
        "name": "encryptedCandidate",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "evaluatePermission",
    "outputs": [
      {
        "internalType": "euint8",
        "name": "matchResult",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      },
      {
        "internalType": "externalEuint8",
        "name": "encryptedLevel",
        "type": "bytes32"
      },
      {
        "internalType": "bytes",
        "name": "inputProof",
        "type": "bytes"
      }
    ],
    "name": "updateAccessLevel",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "permissionId",
        "type": "uint256"
      }
    ],
    "name": "revokeAccess",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
