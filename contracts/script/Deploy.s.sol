// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {AggregationRouter} from "../src/AggregationRouter.sol";
import {UniswapV2Adapter} from "../src/adapters/UniswapV2Adapter.sol";
import {UniswapV3Adapter} from "../src/adapters/UniswapV3Adapter.sol";
import {CurveAdapter} from "../src/adapters/CurveAdapter.sol";

contract Deploy is Script {
    // Sepolia WETH
    address constant SEPOLIA_WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;

    function run() external {
        // Use --account <name> (keystore, recommended) or set PRIVATE_KEY env var
        // If neither is set, Foundry will error with a clear message.
        uint256 deployer = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployer != 0) {
            vm.startBroadcast(deployer);
        } else {
            vm.startBroadcast();
        }

        AggregationRouter router = new AggregationRouter(SEPOLIA_WETH);
        console.log("AggregationRouter:", address(router));

        UniswapV2Adapter adapterV2 = new UniswapV2Adapter();
        console.log("UniswapV2Adapter:", address(adapterV2));

        UniswapV3Adapter adapterV3 = new UniswapV3Adapter();
        console.log("UniswapV3Adapter:", address(adapterV3));

        CurveAdapter adapterCurve = new CurveAdapter();
        console.log("CurveAdapter:", address(adapterCurve));

        vm.stopBroadcast();

        console.log("---");
        console.log("Frontend config (add to web/.env.local):");
        console.log("NEXT_PUBLIC_ROUTER_ADDRESS=", address(router));
        console.log("NEXT_PUBLIC_V2_ADAPTER=", address(adapterV2));
        console.log("NEXT_PUBLIC_V3_ADAPTER=", address(adapterV3));
        console.log("NEXT_PUBLIC_CURVE_ADAPTER=", address(adapterCurve));
    }
}
