// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    FHE,
    eaddress,
    ebool,
    euint8,
    externalEaddress,
    externalEuint8
} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Encrypted access control registry powered by Zama FHE
/// @author Codex
/* solhint-disable max-line-length */
contract EncryptedAccessControl is SepoliaConfig {
    struct Permission {
        bytes32 resourceId;
        address owner;
        eaddress encryptedGrantee;
        euint8 encryptedLevel;
        bool revoked;
        uint256 createdAt;
        uint256 updatedAt;
    }

    uint256 private _permissionCounter;
    mapping(uint256 permissionId => Permission) private _permissions;
    mapping(address owner => uint256[]) private _ownerPermissions;
    mapping(bytes32 resourceId => uint256[]) private _resourcePermissions;
    mapping(uint256 permissionId => mapping(address requester => euint8)) private _evaluationResults;

    event PermissionGranted(uint256 indexed permissionId, address indexed owner, bytes32 indexed resourceId);
    event PermissionRevoked(uint256 indexed permissionId, address indexed owner);
    event PermissionLevelUpdated(uint256 indexed permissionId, address indexed owner);
    event PermissionEvaluated(uint256 indexed permissionId, address indexed requester);

    error PermissionNotFound(uint256 permissionId);
    error NotPermissionOwner(address caller);
    error PermissionRevokedAlready(uint256 permissionId);

    /// @notice Registers a new encrypted permission for a resource.
    /// @param resourceId Application-defined identifier for the protected resource.
    /// @param encryptedGrantee Encrypted grantee address handle produced off-chain.
    /// @param encryptedLevel Encrypted permission level handle produced off-chain.
    /// @param inputProof Zama relayer proof bound to the provided ciphertext handles.
    /// @return permissionId The identifier of the newly created permission entry.
    function grantAccess(
        bytes32 resourceId,
        externalEaddress encryptedGrantee,
        externalEuint8 encryptedLevel,
        bytes calldata inputProof
    ) external returns (uint256 permissionId) {
        eaddress granteeCipher = FHE.fromExternal(encryptedGrantee, inputProof);
        euint8 levelCipher = FHE.fromExternal(encryptedLevel, inputProof);

        permissionId = ++_permissionCounter;

        Permission storage permission = _permissions[permissionId];
        permission.resourceId = resourceId;
        permission.owner = msg.sender;
        permission.encryptedGrantee = granteeCipher;
        permission.encryptedLevel = levelCipher;
        permission.revoked = false;
        permission.createdAt = block.timestamp;
        permission.updatedAt = block.timestamp;

        _ownerPermissions[msg.sender].push(permissionId);
        _resourcePermissions[resourceId].push(permissionId);

        FHE.allowThis(granteeCipher);
        FHE.allowThis(levelCipher);
        FHE.allow(granteeCipher, msg.sender);
        FHE.allow(levelCipher, msg.sender);

        emit PermissionGranted(permissionId, msg.sender, resourceId);
    }

    /// @notice Updates the encrypted permission level for an existing permission.
    /// @param permissionId Identifier of the permission to update.
    /// @param encryptedLevel New encrypted permission level handle.
    /// @param inputProof Relayer proof that authorises the encrypted handle.
    function updateAccessLevel(
        uint256 permissionId,
        externalEuint8 encryptedLevel,
        bytes calldata inputProof
    ) external {
        Permission storage permission = _permissions[permissionId];
        if (permission.owner == address(0)) {
            revert PermissionNotFound(permissionId);
        }
        if (permission.owner != msg.sender) {
            revert NotPermissionOwner(msg.sender);
        }
        if (permission.revoked) {
            revert PermissionRevokedAlready(permissionId);
        }

        euint8 newLevel = FHE.fromExternal(encryptedLevel, inputProof);
        permission.encryptedLevel = newLevel;
        permission.updatedAt = block.timestamp;

        FHE.allowThis(newLevel);
        FHE.allow(newLevel, msg.sender);

        emit PermissionLevelUpdated(permissionId, msg.sender);
    }

    /// @notice Revokes an existing permission.
    /// @param permissionId Identifier of the permission to revoke.
    function revokeAccess(uint256 permissionId) external {
        Permission storage permission = _permissions[permissionId];
        if (permission.owner == address(0)) {
            revert PermissionNotFound(permissionId);
        }
        if (permission.owner != msg.sender) {
            revert NotPermissionOwner(msg.sender);
        }
        if (permission.revoked) {
            revert PermissionRevokedAlready(permissionId);
        }

        permission.revoked = true;
        permission.updatedAt = block.timestamp;

        emit PermissionRevoked(permissionId, msg.sender);
    }

    /// @notice Returns a permission entry.
    /// @param permissionId The identifier of the permission.
    /// @return resourceId Resource identifier bound to the permission.
    /// @return owner Address that controls the permission lifecycle.
    /// @return encryptedGrantee Encrypted grantee address.
    /// @return encryptedLevel Encrypted permission level value.
    /// @return revoked Whether the permission has been revoked.
    /// @return createdAt Block timestamp for creation.
    /// @return updatedAt Block timestamp for the last update.
    function getPermission(
        uint256 permissionId
    )
        external
        view
        returns (
            bytes32 resourceId,
            address owner,
            eaddress encryptedGrantee,
            euint8 encryptedLevel,
            bool revoked,
            uint256 createdAt,
            uint256 updatedAt
        )
    {
        Permission storage permission = _permissions[permissionId];
        if (permission.owner == address(0)) {
            revert PermissionNotFound(permissionId);
        }

        return (
            permission.resourceId,
            permission.owner,
            permission.encryptedGrantee,
            permission.encryptedLevel,
            permission.revoked,
            permission.createdAt,
            permission.updatedAt
        );
    }

    /// @notice Lists permission identifiers controlled by an owner.
    /// @param owner Address of the owner to inspect.
    /// @return ids Array of permission identifiers.
    function getOwnerPermissions(address owner) external view returns (uint256[] memory ids) {
        return _ownerPermissions[owner];
    }

    /// @notice Lists permission identifiers associated with a resource.
    /// @param resourceId Identifier of the resource.
    /// @return ids Array of permission identifiers.
    function getResourcePermissions(bytes32 resourceId) external view returns (uint256[] memory ids) {
        return _resourcePermissions[resourceId];
    }

    /// @notice Returns the latest encrypted evaluation result for a requester.
    /// @param permissionId Identifier of the permission evaluated previously.
    /// @param requester Address that initiated the evaluation.
    /// @return result Last encrypted evaluation outcome.
    function getEvaluationResult(uint256 permissionId, address requester) external view returns (euint8 result) {
        return _evaluationResults[permissionId][requester];
    }

    /// @notice Evaluates whether an encrypted address matches the stored grantee for a permission.
    /// @param permissionId Identifier of the permission to evaluate.
    /// @param encryptedCandidate Encrypted address handle generated by the caller.
    /// @param inputProof Proof that binds the encrypted candidate to the caller.
    /// @return matchResult Encrypted integer (1 when matched, 0 otherwise).
    function evaluatePermission(
        uint256 permissionId,
        externalEaddress encryptedCandidate,
        bytes calldata inputProof
    ) external returns (euint8 matchResult) {
        Permission storage permission = _permissions[permissionId];
        if (permission.owner == address(0)) {
            revert PermissionNotFound(permissionId);
        }
        if (permission.revoked) {
            revert PermissionRevokedAlready(permissionId);
        }

        eaddress candidate = FHE.fromExternal(encryptedCandidate, inputProof);
        ebool matches = FHE.eq(permission.encryptedGrantee, candidate);
        matchResult = FHE.select(matches, FHE.asEuint8(1), FHE.asEuint8(0));

        _evaluationResults[permissionId][msg.sender] = matchResult;

        FHE.allow(matchResult, msg.sender);
        FHE.allow(matchResult, permission.owner);
        FHE.allowThis(matchResult);

        emit PermissionEvaluated(permissionId, msg.sender);
    }
}
/* solhint-enable max-line-length */
