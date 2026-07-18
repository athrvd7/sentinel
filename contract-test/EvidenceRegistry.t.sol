// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {EvidenceRegistry} from "../contracts/EvidenceRegistry.sol";

contract ExternalCaller {
    function register(EvidenceRegistry registry, bytes32 caseId, bytes32 evidenceHash) external {
        registry.registerCase(caseId, evidenceHash, "bafy-test");
    }
}

contract EvidenceRegistryTest {
    function testRegistersEvidenceAndStartsSubmitted() public {
        EvidenceRegistry registry = new EvidenceRegistry(address(this));
        bytes32 caseId = keccak256("case");
        bytes32 evidenceHash = keccak256("evidence");

        registry.registerCase(caseId, evidenceHash, "bafy-test");

        (bytes32 storedHash, string memory cid, EvidenceRegistry.CaseStatus status, bool registered) = registry.cases(caseId);
        require(storedHash == evidenceHash, "hash mismatch");
        require(keccak256(bytes(cid)) == keccak256(bytes("bafy-test")), "cid mismatch");
        require(status == EvidenceRegistry.CaseStatus.Submitted, "status mismatch");
        require(registered, "case not registered");
    }

    function testRejectsDuplicateRegistration() public {
        EvidenceRegistry registry = new EvidenceRegistry(address(this));
        bytes32 caseId = keccak256("case");
        registry.registerCase(caseId, keccak256("evidence"), "bafy-test");

        bool reverted;
        try registry.registerCase(caseId, keccak256("other"), "bafy-other") {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "duplicate accepted");
    }

    function testRestrictsWritesToRelay() public {
        EvidenceRegistry registry = new EvidenceRegistry(address(this));
        ExternalCaller caller = new ExternalCaller();

        bool reverted;
        try caller.register(registry, keccak256("case"), keccak256("evidence")) {
            reverted = false;
        } catch {
            reverted = true;
        }

        require(reverted, "non-relay write accepted");
    }
}
