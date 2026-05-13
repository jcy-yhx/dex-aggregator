// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {SwapDescription, RouteStep} from "./types/DataTypes.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {Executor} from "./Executor.sol";
import {TransferHelper} from "./libraries/TransferHelper.sol";

// Ownable：合约拥有者可调用 rescueTokens 救援资金。
// ReentrancyGuard：防止重入攻击（nonReentrant 修饰器）。
contract AggregationRouter is Ownable, ReentrancyGuard {
    using TransferHelper for address;

    uint256 private constant _PARTIAL_FILL = 0x02;  // 支持部分成交
    uint256 private constant _UNWRAP_WETH = 0x01;   // 最终需要解包成 ETH

    IWETH public immutable weth;    //WETH 合约地址（immutable）。
    Executor public immutable executor;     //专门执行具体交换逻辑的合约

    event Swapped(
        address indexed sender,
        address indexed srcToken,
        address indexed dstToken,
        address dstReceiver,
        uint256 spentAmount,
        uint256 returnAmount
    );

    constructor(address weth_) Ownable(msg.sender) {
        weth = IWETH(weth_);
        executor = new Executor();
    }

    receive() external payable {
        // Only accept ETH from WETH contract (unwrapping)
    }

    function swap(
        SwapDescription calldata desc,
        RouteStep[][] calldata routes
    ) external payable nonReentrant returns (uint256 returnAmount, uint256 spentAmount) {
        // Handle permit (EIP-2612)
        if (desc.permit.length > 0) {
            _permit(desc.srcToken, desc.permit);
        }

        // Handle ETH -> WETH wrapping
        //这段代码就是 “资金入口”，负责把用户的钱（不管是 ETH 还是 ERC20）安全、正确地转入 Router 合约，为后续的 swap 执行做好准备。
        if (msg.value > 0) {
            // 用户直接发送了原生 ETH
            require(
                desc.srcToken == address(weth),
                "Router: srcToken must be WETH when sending ETH"
            );
            weth.deposit{value: msg.value}(); // 把 ETH 包装成 WETH
            spentAmount = msg.value;
        } else {
            spentAmount = desc.amount;
            desc.srcToken.safeTransferFrom(msg.sender, address(this), desc.amount);
        }

        // Execute each route via delegatecall to Executor
        returnAmount = 0;
        for (uint256 i = 0; i < routes.length; i++) {
            uint256 routeIn = routes[i][0].amount;
            if (routeIn == 0) {
                routeIn = spentAmount;
            }

            (bool ok, bytes memory ret) = address(executor).delegatecall(
                abi.encodeWithSelector(Executor.executeRoute.selector, routes[i])
            );

            if (!ok) {
                if (ret.length > 0) {
                    assembly {
                        revert(add(32, ret), mload(ret))
                    }
                } else {
                    revert("Router: route execution failed");
                }
            }

            returnAmount += abi.decode(ret, (uint256));
        }

        // Enforce slippage tolerance
        if ((desc.flags & _PARTIAL_FILL) == 0) {
            require(
                returnAmount >= desc.minReturnAmount,
                "Router: minReturnAmount not met"
            );
        }

        // Send output to dstReceiver
        if ((desc.flags & _UNWRAP_WETH) != 0) {
            require(
                desc.dstToken == address(weth),
                "Router: dstToken must be WETH to unwrap"
            );
            weth.withdraw(returnAmount);
            _safeTransferETH(desc.dstReceiver, returnAmount);
        } else {
            desc.dstToken.safeTransfer(desc.dstReceiver, returnAmount);
        }

        // Refund any remaining srcToken
        uint256 srcBalance = IERC20(desc.srcToken).balanceOf(address(this));
        if (srcBalance > 0) {
            desc.srcToken.safeTransfer(msg.sender, srcBalance);
            spentAmount -= srcBalance;
        }

        emit Swapped(
            msg.sender,
            desc.srcToken,
            desc.dstToken,
            desc.dstReceiver,
            spentAmount,
            returnAmount
        );
    }

    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        // Decode token addresses passed by the V3 adapter
        (address token0, address token1) = abi.decode(data, (address, address));

        if (amount0Delta > 0) {
            token0.safeTransfer(msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            token1.safeTransfer(msg.sender, uint256(amount1Delta));
        }
    }

    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }

    function _permit(address token, bytes calldata data) internal {
        (uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) = abi.decode(
            data,
            (uint256, uint256, uint8, bytes32, bytes32)
        );
        IERC20Permit(token).permit(
            msg.sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );
    }

    function _safeTransferETH(address to, uint256 value) internal {
        (bool success, ) = to.call{value: value}("");
        require(success, "Router: ETH transfer failed");
    }
}
