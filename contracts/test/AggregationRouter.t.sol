// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";

import {AggregationRouter} from "../src/AggregationRouter.sol";
import {Executor} from "../src/Executor.sol";
import {SwapDescription, RouteStep} from "../src/types/DataTypes.sol";
import {UniswapV2Adapter} from "../src/adapters/UniswapV2Adapter.sol";
import {UniswapV3Adapter} from "../src/adapters/UniswapV3Adapter.sol";
import {CurveAdapter} from "../src/adapters/CurveAdapter.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockWETH} from "./mocks/MockWETH.sol";
import {MockUniswapV2Pair} from "./mocks/MockUniswapV2Pair.sol";
import {MockUniswapV3Pool} from "./mocks/MockUniswapV3Pool.sol";
import {MockCurvePool} from "./mocks/MockCurvePool.sol";

contract AggregationRouterTest is Test {
    AggregationRouter router;
    MockWETH weth;
    MockERC20 usdc;
    MockERC20 dai;

    UniswapV2Adapter adapterV2;
    UniswapV3Adapter adapterV3;
    CurveAdapter adapterCurve;

    MockUniswapV2Pair v2PairWethUsdc;
    MockUniswapV3Pool v3PoolWethUsdc;
    MockCurvePool curvePoolUsdcDai;

    address user;

    function setUp() public {
        user = makeAddr("user");

        weth = new MockWETH();
        usdc = new MockERC20("USD Coin", "USDC", 6);
        dai = new MockERC20("Dai Stablecoin", "DAI", 18);

        router = new AggregationRouter(address(weth));

        adapterV2 = new UniswapV2Adapter();
        adapterV3 = new UniswapV3Adapter();
        adapterCurve = new CurveAdapter();

        _setupPools();
    }

    function _setupPools() internal {
        // V2 WETH-USDC pool: 10 WETH + 20000 USDC
        v2PairWethUsdc = new MockUniswapV2Pair(address(weth), address(usdc));
        weth.mint(address(v2PairWethUsdc), 10 ether);
        usdc.mint(address(v2PairWethUsdc), 20000e6);
        v2PairWethUsdc.setReserves(10 ether, 20000e6);

        // V3 WETH-USDC pool (token0=USDC, token1=WETH): 20000 USDC + 10 WETH, 0.3% fee
        v3PoolWethUsdc = new MockUniswapV3Pool(address(usdc), address(weth), 3000);
        usdc.mint(address(v3PoolWethUsdc), 20000e6);
        weth.mint(address(v3PoolWethUsdc), 10 ether);
        v3PoolWethUsdc.setReserves(20000e6, 10 ether);

        // Curve USDC-DAI pool: 50000 USDC + 50000 DAI
        address[2] memory tokens = [address(usdc), address(dai)];
        curvePoolUsdcDai = new MockCurvePool(tokens);
        usdc.mint(address(curvePoolUsdcDai), 50000e6);
        dai.mint(address(curvePoolUsdcDai), 50000 ether);
    }

    function _fundUserWithWeth(uint256 amount) internal {
        vm.deal(user, amount);
        vm.prank(user);
        weth.deposit{value: amount}();
        vm.prank(user);
        weth.approve(address(router), type(uint256).max);
    }

    function test_Deployment() public view {
        assertEq(address(router.weth()), address(weth));
        assertTrue(address(router.executor()) != address(0));
        assertTrue(address(router.owner()) != address(0));
    }

    function test_Swap_WETH_USDC_SingleV2() public {
        _fundUserWithWeth(1 ether);

        uint256 amountIn = 0.1 ether;
        uint256 expectedOut = (amountIn * 997 * 20000e6) /
            (10 ether * 1000 + amountIn * 997);

        SwapDescription memory desc = SwapDescription({
            srcToken: address(weth),
            dstToken: address(usdc),
            dstReceiver: payable(user),
            amount: amountIn,
            minReturnAmount: (expectedOut * 99) / 100,
            flags: 0,
            permit: ""
        });

        RouteStep[] memory steps = new RouteStep[](1);
        steps[0] = RouteStep({
            pool: address(v2PairWethUsdc),
            adapter: address(adapterV2),
            tokenIn: address(weth),
            tokenOut: address(usdc),
            amount: amountIn,
            extraData: ""
        });

        RouteStep[][] memory routes = new RouteStep[][](1);
        routes[0] = steps;

        vm.prank(user);
        (uint256 returnAmount, uint256 spentAmount) = router.swap(desc, routes);

        assertApproxEqAbs(returnAmount, expectedOut, 1, "output mismatch");
        assertEq(spentAmount, amountIn, "spent mismatch");
        assertEq(usdc.balanceOf(user), returnAmount, "user usdc balance");
    }

    function test_Swap_WETH_USDC_SingleV3() public {
        _fundUserWithWeth(1 ether);

        uint256 amountIn = 0.1 ether;
        // V3 pool: token0=USDC, token1=WETH. Swapping WETH->USDC = swapping token1 for token0.
        // zeroForOne=false, amountSpecified is positive (exact input of token1).
        // amountOut = (amountIn * (1e6 - fee) * reserve0) / (reserve1 * 1e6 + amountIn * (1e6 - fee))
        uint256 expectedOut = (amountIn * (1_000_000 - 3000) * 20000e6) /
            (10 ether * 1_000_000 + amountIn * (1_000_000 - 3000));

        SwapDescription memory desc = SwapDescription({
            srcToken: address(weth),
            dstToken: address(usdc),
            dstReceiver: payable(user),
            amount: amountIn,
            minReturnAmount: (expectedOut * 99) / 100,
            flags: 0,
            permit: ""
        });

        RouteStep[] memory steps = new RouteStep[](1);
        steps[0] = RouteStep({
            pool: address(v3PoolWethUsdc),
            adapter: address(adapterV3),
            tokenIn: address(weth),
            tokenOut: address(usdc),
            amount: amountIn,
            extraData: ""
        });

        RouteStep[][] memory routes = new RouteStep[][](1);
        routes[0] = steps;

        vm.prank(user);
        (uint256 returnAmount, ) = router.swap(desc, routes);

        assertApproxEqAbs(returnAmount, expectedOut, 2, "output mismatch");
    }

    function test_Swap_WETH_USDC_SplitV2V3() public {
        _fundUserWithWeth(1 ether);

        uint256 totalIn = 0.2 ether;
        uint256 halfIn = 0.1 ether;

        // Expected from V2
        uint256 v2Out = (halfIn * 997 * 20000e6) /
            (10 ether * 1000 + halfIn * 997);
        // Expected from V3
        uint256 v3Out = (halfIn * (1_000_000 - 3000) * 20000e6) /
            (10 ether * 1_000_000 + halfIn * (1_000_000 - 3000));

        uint256 totalExpected = v2Out + v3Out;

        SwapDescription memory desc = SwapDescription({
            srcToken: address(weth),
            dstToken: address(usdc),
            dstReceiver: payable(user),
            amount: totalIn,
            minReturnAmount: (totalExpected * 99) / 100,
            flags: 0,
            permit: ""
        });

        // Route 1: V2
        RouteStep[] memory route1 = new RouteStep[](1);
        route1[0] = RouteStep({
            pool: address(v2PairWethUsdc),
            adapter: address(adapterV2),
            tokenIn: address(weth),
            tokenOut: address(usdc),
            amount: halfIn,
            extraData: ""
        });

        // Route 2: V3
        RouteStep[] memory route2 = new RouteStep[](1);
        route2[0] = RouteStep({
            pool: address(v3PoolWethUsdc),
            adapter: address(adapterV3),
            tokenIn: address(weth),
            tokenOut: address(usdc),
            amount: halfIn,
            extraData: ""
        });

        RouteStep[][] memory routes = new RouteStep[][](2);
        routes[0] = route1;
        routes[1] = route2;

        vm.prank(user);
        (uint256 returnAmount, uint256 spentAmount) = router.swap(desc, routes);

        assertApproxEqAbs(returnAmount, totalExpected, 3, "split output mismatch");
        assertEq(spentAmount, totalIn, "spent mismatch");
    }

    function test_Swap_WETH_DAI_MultiHop_V2Curve() public {
        _fundUserWithWeth(1 ether);
        vm.prank(user);
        usdc.approve(address(router), type(uint256).max);

        uint256 amountIn = 0.1 ether;

        // Expected WETH -> USDC via V2
        uint256 expectedUsdc = (amountIn * 997 * 20000e6) /
            (10 ether * 1000 + amountIn * 997);
        // Curve mock deducts 0.04% fee, no decimal conversion
        uint256 expectedDai = expectedUsdc - (expectedUsdc / 2500);

        SwapDescription memory desc = SwapDescription({
            srcToken: address(weth),
            dstToken: address(dai),
            dstReceiver: payable(user),
            amount: amountIn,
            minReturnAmount: expectedDai / 2, // wide tolerance for multi-hop
            flags: 0,
            permit: ""
        });

        // Multi-hop: WETH -> USDC (V2), then USDC -> DAI (Curve)
        RouteStep[] memory steps = new RouteStep[](2);
        steps[0] = RouteStep({
            pool: address(v2PairWethUsdc),
            adapter: address(adapterV2),
            tokenIn: address(weth),
            tokenOut: address(usdc),
            amount: amountIn,
            extraData: ""
        });
        steps[1] = RouteStep({
            pool: address(curvePoolUsdcDai),
            adapter: address(adapterCurve),
            tokenIn: address(usdc),
            tokenOut: address(dai),
            amount: 0, // Use output from previous step
            extraData: abi.encode(int128(0), int128(1)) // USDC=coin0, DAI=coin1
        });

        RouteStep[][] memory routes = new RouteStep[][](1);
        routes[0] = steps;

        vm.prank(user);
        (uint256 returnAmount, ) = router.swap(desc, routes);

        assertGt(returnAmount, 0, "zero output");
        assertEq(dai.balanceOf(user), returnAmount, "user dai balance");
        assertEq(usdc.balanceOf(user), 0, "should have no leftover usdc");
    }

    function test_Swap_Reverts_SlippageTooHigh() public {
        _fundUserWithWeth(1 ether);

        SwapDescription memory desc = SwapDescription({
            srcToken: address(weth),
            dstToken: address(usdc),
            dstReceiver: payable(user),
            amount: 0.1 ether,
            minReturnAmount: type(uint256).max, // impossible
            flags: 0,
            permit: ""
        });

        RouteStep[] memory steps = new RouteStep[](1);
        steps[0] = RouteStep({
            pool: address(v2PairWethUsdc),
            adapter: address(adapterV2),
            tokenIn: address(weth),
            tokenOut: address(usdc),
            amount: 0.1 ether,
            extraData: ""
        });

        RouteStep[][] memory routes = new RouteStep[][](1);
        routes[0] = steps;

        vm.prank(user);
        vm.expectRevert("Router: minReturnAmount not met");
        router.swap(desc, routes);
    }

    function test_Swap_WithETH() public {
        // User wraps ETH to WETH first, then swaps via Router
        vm.deal(user, 1 ether);
        vm.prank(user);
        weth.deposit{value: 1 ether}();
        vm.prank(user);
        weth.approve(address(router), type(uint256).max);

        uint256 amountIn = 0.1 ether;
        uint256 expectedOut = (amountIn * 997 * 20000e6) /
            (10 ether * 1000 + amountIn * 997);

        SwapDescription memory desc = SwapDescription({
            srcToken: address(weth),
            dstToken: address(usdc),
            dstReceiver: payable(user),
            amount: amountIn,
            minReturnAmount: (expectedOut * 99) / 100,
            flags: 0,
            permit: ""
        });

        RouteStep[] memory steps = new RouteStep[](1);
        steps[0] = RouteStep({
            pool: address(v2PairWethUsdc),
            adapter: address(adapterV2),
            tokenIn: address(weth),
            tokenOut: address(usdc),
            amount: amountIn,
            extraData: ""
        });

        RouteStep[][] memory routes = new RouteStep[][](1);
        routes[0] = steps;

        vm.prank(user);
        (uint256 returnAmount, ) = router.swap(desc, routes);

        assertApproxEqAbs(returnAmount, expectedOut, 1, "ETH swap output mismatch");
    }

    function test_Swap_UnwrapWETH() public {
        // Seed MockWETH with ETH so withdraw() can send ETH back
        vm.deal(address(weth), 10 ether);

        usdc.mint(user, 1000e6);
        vm.prank(user);
        usdc.approve(address(router), type(uint256).max);

        uint256 amountIn = 1000e6;
        uint256 expectedOut = (amountIn * 997 * 10 ether) /
            (20000e6 * 1000 + amountIn * 997);

        SwapDescription memory desc = SwapDescription({
            srcToken: address(usdc),
            dstToken: address(weth),
            dstReceiver: payable(user),
            amount: amountIn,
            minReturnAmount: (expectedOut * 99) / 100,
            flags: 1, // UNWRAP_WETH
            permit: ""
        });

        RouteStep[] memory steps = new RouteStep[](1);
        steps[0] = RouteStep({
            pool: address(v2PairWethUsdc),
            adapter: address(adapterV2),
            tokenIn: address(usdc),
            tokenOut: address(weth),
            amount: amountIn,
            extraData: ""
        });

        RouteStep[][] memory routes = new RouteStep[][](1);
        routes[0] = steps;

        uint256 ethBefore = user.balance;

        vm.prank(user);
        router.swap(desc, routes);

        uint256 ethAfter = user.balance;
        assertApproxEqAbs(ethAfter - ethBefore, expectedOut, 2, "ETH received mismatch");
    }
}
