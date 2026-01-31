# Chia Conditions Reference for Rue

## Signature Conditions

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| AGG_SIG_ME | 50 | `AggSigMe { public_key, message }` | Sign message + coin_id + genesis_id |
| AGG_SIG_UNSAFE | 49 | `AggSigUnsafe { public_key, message }` | Sign message only (dangerous) |
| AGG_SIG_PARENT | 43 | `AggSigParent { public_key, message }` | Sign message + parent_id |
| AGG_SIG_PUZZLE | 44 | `AggSigPuzzle { public_key, message }` | Sign message + puzzle_hash |
| AGG_SIG_AMOUNT | 45 | `AggSigAmount { public_key, message }` | Sign message + amount |

## Coin Creation

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| CREATE_COIN | 51 | `CreateCoin { puzzle_hash, amount, memos }` | Create new coin output |
| RESERVE_FEE | 52 | `ReserveFee { amount }` | Reserve minimum fee |

## Assertions - Identity

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| ASSERT_MY_COIN_ID | 70 | `AssertMyCoinId { coin_id }` | Verify own coin ID |
| ASSERT_MY_PARENT_ID | 71 | `AssertMyParentId { parent_id }` | Verify parent coin ID |
| ASSERT_MY_PUZZLEHASH | 72 | `AssertMyPuzzlehash { puzzle_hash }` | Verify own puzzle hash |
| ASSERT_MY_AMOUNT | 73 | `AssertMyAmount { amount }` | Verify own amount |

## Assertions - Time (Block Height)

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| ASSERT_HEIGHT_RELATIVE | 82 | `AssertHeightRelative { height }` | Min blocks since creation |
| ASSERT_HEIGHT_ABSOLUTE | 83 | `AssertHeightAbsolute { height }` | Min block height |
| ASSERT_BEFORE_HEIGHT_RELATIVE | 86 | `AssertBeforeHeightRelative { height }` | Max blocks since creation |
| ASSERT_BEFORE_HEIGHT_ABSOLUTE | 87 | `AssertBeforeHeightAbsolute { height }` | Max block height |

## Assertions - Time (Seconds)

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| ASSERT_SECONDS_RELATIVE | 80 | `AssertSecondsRelative { seconds }` | Min seconds since creation |
| ASSERT_SECONDS_ABSOLUTE | 81 | `AssertSecondsAbsolute { seconds }` | Min timestamp |
| ASSERT_BEFORE_SECONDS_RELATIVE | 84 | `AssertBeforeSecondsRelative { seconds }` | Max seconds since creation |
| ASSERT_BEFORE_SECONDS_ABSOLUTE | 85 | `AssertBeforeSecondsAbsolute { seconds }` | Max timestamp |

## Assertions - Birth

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| ASSERT_MY_BIRTH_SECONDS | 74 | `AssertMyBirthSeconds { seconds }` | Verify creation timestamp |
| ASSERT_MY_BIRTH_HEIGHT | 75 | `AssertMyBirthHeight { height }` | Verify creation block |
| ASSERT_EPHEMERAL | 76 | `AssertEphemeral {}` | Created this block |

## Assertions - Concurrent Spends

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| ASSERT_CONCURRENT_SPEND | 64 | `AssertConcurrentSpend { coin_id }` | Require coin spent together |
| ASSERT_CONCURRENT_PUZZLE | 65 | `AssertConcurrentPuzzle { puzzle_hash }` | Require puzzle spent together |

## Messaging (CHIP-0025)

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| SEND_MESSAGE | 66 | `SendMessage { mode, message, ... }` | Send inter-coin message |
| RECEIVE_MESSAGE | 67 | `ReceiveMessage { mode, message, ... }` | Receive inter-coin message |

## Announcements (Legacy)

| Condition | Code | Rue Type | Description |
|-----------|------|----------|-------------|
| CREATE_COIN_ANNOUNCEMENT | 60 | `CreateCoinAnnouncement { message }` | Announce from coin |
| ASSERT_COIN_ANNOUNCEMENT | 61 | `AssertCoinAnnouncement { announcement_id }` | Assert coin announcement |
| CREATE_PUZZLE_ANNOUNCEMENT | 62 | `CreatePuzzleAnnouncement { message }` | Announce from puzzle |
| ASSERT_PUZZLE_ANNOUNCEMENT | 63 | `AssertPuzzleAnnouncement { announcement_id }` | Assert puzzle announcement |

## Common Patterns

### Burn (No Outputs)
```rue
fn main(public_key: PublicKey) -> List<Condition> {
    [AggSigMe { public_key, message: tree_hash([]) }]
}
```

### Timelock
```rue
fn main(unlock_height: Int, ...) -> List<Condition> {
    [AssertHeightAbsolute { height: unlock_height }, ...]
}
```

### Royalty Split
```rue
let royalty = (amount * percentage) / 100;
[CreateCoin { puzzle_hash: creator, amount: royalty, memos: nil },
 CreateCoin { puzzle_hash: recipient, amount: amount - royalty, memos: nil }]
```

### Singleton (Self-Recreating)
```rue
[AssertMyCoinId { coin_id: my_id },
 CreateCoin { puzzle_hash: my_puzzle_hash, amount: new_amount, memos: nil }]
```
