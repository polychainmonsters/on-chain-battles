// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./randomness/interfaces/IRandomnessV1.sol";
import "./metadata/interfaces/IBattlemonMetadataV1.sol";
import "./allowlist/interfaces/IAllowlistV1.sol";

contract MyToken is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721URIStorageUpgradeable,
    ERC721BurnableUpgradeable,
    AccessControlUpgradeable,
    EIP712Upgradeable,
    ERC721VotesUpgradeable
{
    struct Edition {
        uint256 supply;
        uint256 maxSupply;
        uint256 price;
        address paymentReceiver;
        IBattlemonMetadataV1 metadata;
        IAllowlistV1 allowlist;
    }

    struct TokenInfo {
        uint256 mintDate;
        uint256 random;
        uint256 editionId;
    }

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /****************************
     * VARIABLES *
     ***************************/

    /// @dev Our oracle
    IRandomnessV1 public randomness;

    uint256 private _nextTokenId;

    /****************************
     * MAPPINGS *
     ***************************/

    /// @dev Storage of the random numbers
    mapping(uint256 => uint256) public tokenInfo;

    /// @dev Mapping of edition IDs to editions
    mapping(uint24 => Edition) public editions;

    /****************************
     * EVENTS *
     ***************************/

    event RandomWordsFulfilled(
        uint256 indexed tokenId,
        uint256 indexed randomness
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address defaultAdmin,
        address minter
    ) public initializer {
        __ERC721_init("BattlemonV1", "BTLMON");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __ERC721Burnable_init();
        __AccessControl_init();
        __EIP712_init("BattlemonV1", "1");
        __ERC721Votes_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, minter);
    }

    function safeMint(
        address to,
        string memory uri
    ) public onlyRole(MINTER_ROLE) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // The following functions are overrides required by Solidity.

    // The following functions are overrides required by Solidity.

    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            ERC721VotesUpgradeable
        )
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    )
        internal
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            ERC721VotesUpgradeable
        )
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            ERC721URIStorageUpgradeable,
            AccessControlUpgradeable
        )
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
