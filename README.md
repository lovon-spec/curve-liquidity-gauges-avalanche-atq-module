# Curve Finance liquidity gauges on Avalanche

ATQ module for the nonzero liquidity gauges referenced by every indexed liquidity pool in Messari's published Curve Finance Avalanche subgraph. LP tokens and pool contracts are not emitted. Includes historical and zero-supply gauges without asserting current rewards.

Official source catalogue: https://github.com/messari/subgraphs/blob/master/deployment/deployment.json
Subgraph: 2Vt8WtdXNZUEeaVtzyEd1dpioJf44nvomzkd4HhubfKS
Deployment: QmZyoRwhXKY2o9Yxqur5hNufKPPSwhZANtf4QQaiqC7Qms

All liquidityPools are read at one indexed block hash using strictly increasing address-valued IDs; no sequential unique field is defined. Only a literal zero gauge address represents no gauge. Malformed addresses or metadata fail the call. Each distinct gauge is emitted once. No activity, supply, reward, pool-count or output-count filters are applied.

Public names use the official implementation template, Curve.fi <LP token symbol> Gauge Deposit, without truncation. Official source: https://github.com/curvefi/curve-xchain-factory/blob/master/contracts/implementations/ChildGauge.vy
Names longer than 50 characters or ambiguous names fail the complete call.

Build with Yarn and call the sole exported async returnTags(chainId, apiKey). This preparation draft confers no filing authority.
