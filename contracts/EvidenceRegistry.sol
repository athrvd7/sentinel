// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract EvidenceRegistry {
    enum CaseStatus {
        Submitted,
        UnderReview,
        Resolved
    }

    struct CaseProof {
        bytes32 evidenceHash;
        string contentId;
        CaseStatus status;
        bool registered;
    }

    address public immutable relay;
    mapping(bytes32 caseId => CaseProof proof) private caseProofs;

    event CaseRegistered(bytes32 indexed caseId, bytes32 indexed evidenceHash, string contentId);
    event MessageAnchored(bytes32 indexed caseId, bytes32 indexed messageHash);
    event StatusUpdated(bytes32 indexed caseId, CaseStatus status);

    modifier onlyRelay() {
        require(msg.sender == relay, "relay only");
        _;
    }

    constructor(address relayAddress) {
        require(relayAddress != address(0), "relay required");
        relay = relayAddress;
    }

    function registerCase(bytes32 caseId, bytes32 evidenceHash, string calldata contentId) external onlyRelay {
        require(caseId != bytes32(0), "case required");
        require(evidenceHash != bytes32(0), "evidence required");
        require(bytes(contentId).length > 0, "content required");
        require(!caseProofs[caseId].registered, "case exists");

        caseProofs[caseId] = CaseProof({
            evidenceHash: evidenceHash,
            contentId: contentId,
            status: CaseStatus.Submitted,
            registered: true
        });

        emit CaseRegistered(caseId, evidenceHash, contentId);
    }

    function appendMessage(bytes32 caseId, bytes32 messageHash) external onlyRelay {
        require(caseProofs[caseId].registered, "case missing");
        require(messageHash != bytes32(0), "message required");

        emit MessageAnchored(caseId, messageHash);
    }

    function updateStatus(bytes32 caseId, CaseStatus status) external onlyRelay {
        require(caseProofs[caseId].registered, "case missing");

        caseProofs[caseId].status = status;
        emit StatusUpdated(caseId, status);
    }

    function cases(bytes32 caseId)
        external
        view
        returns (bytes32 evidenceHash, string memory contentId, CaseStatus status, bool registered)
    {
        CaseProof storage proof = caseProofs[caseId];
        return (proof.evidenceHash, proof.contentId, proof.status, proof.registered);
    }
}
