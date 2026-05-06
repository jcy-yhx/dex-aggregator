// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

library TransferHelper {
    using SafeERC20 for IERC20;

    function safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        IERC20(token).safeTransferFrom(from, to, amount);
    }

    function safeTransfer(address token, address to, uint256 amount) internal {
        IERC20(token).safeTransfer(to, amount);
    }

    function safeApprove(address token, address to, uint256 amount) internal {
        IERC20(token).forceApprove(to, amount);
    }

    function safeApproveMax(address token, address to) internal {
        IERC20(token).forceApprove(to, type(uint256).max);
    }

    function universalApproveMax(
        address token,
        address to,
        uint256 amount
    ) internal {
        IERC20 token_ = IERC20(token);
        uint256 allowance = token_.allowance(address(this), to);

        if (allowance < amount) {
            if (allowance > 0) {
                token_.forceApprove(to, 0);
            }
            token_.forceApprove(to, type(uint256).max);
        }
    }
}
