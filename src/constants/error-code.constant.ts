export enum ErrorCode {
  // 特殊的状态码
  ErrAuthTokenInvalid = '401:令牌已失效，请重新登录',

  // system
  ErrInternalServer = '10000:Internal server error',
  ErrInvalidParam = '10001:Invalid params',
  ErrUnauthorized = '10002:Unauthorized error',
  ErrNotFound = '10003:Not found',
  ErrUnknown = '10004:Unknown',
  ErrDeadlineExceeded = '10005:Deadline exceeded',
  ErrAccessDenied = '10006:Access denied',
  ErrLimitExceed = '10007:Beyond limit',
  ErrMethodNotAllowed = '10008:Method not allowed',
  ErrSignParam = '10011:Invalid sign',
  ErrSignatureMissing = '10021:签名信息缺失',
  ErrSignatureInvalid = '10022:签名验证失败',
  ErrTimestampInvalid = '10023:时间戳无效或已过期',
  ErrValidation = '10012:Validation failed',
  ErrDatabase = '10013:Database error',
  ErrToken = '10014:Gen token error',
  ErrInvalidToken = '10015:Invalid token',
  ErrTokenTimeout = '10016:Token timeout',
  ErrTooManyRequests = '10017:Too many request',
  ErrInvalidTransaction = '10018:Invalid transaction',
  ErrEncrypt = '10019:Encrypting the user password error',
  ErrServiceUnavailable = '10020:Service Unavailable',
  ErrRepeatOperation = '10021:Repeat Operation',
  ErrDataNotFound = '10022:Data Not Found',

  // user (20xxx)
  ErrUsernameNotFound = '20101:用户名不存在',
  ErrPhoneNotFound = '20102:手机号不存在',
  ErrUserTokenExpired = '20103:登录过期，请重新登录',
  ErrUserOffline = '20104:您已离线，请重连',
  ErrUserFrozen = '20105:账号已被冻结',
  ErrUserNoSelf = '20106:不可以操作自己',
  ErrUserExisted = '20107:用户名已存在',
  ErrPhoneExisted = '20108:手机号已存在',
  ErrPasswordNotMatch = '20109:密码错误',
  ErrActionNotSelf = '20110:不可以操作自己',
  ErrUserNotFound = '20111:用户不存在',
  ErrPasswordSame = '20112:新密码不能与当前密码相同',
  ErrPasswordConfirmNotMatch = '20113:两次输入的密码不一致',
  ErrTransPasswordNotSet = '20114:请先设置交易密码',
  ErrTransPasswordAlreadySet = '20115:已设置交易密码，请使用修改功能',
  ErrTransPasswordNotMatch = '20116:交易密码错误',
  ErrUserNotDeleted = '20117:用户不存在或未被删除',

  // wallet (21xxx)
  ErrWalletNotFound = '21101:钱包记录不存在',
  ErrBalanceInsufficient = '21102:余额不足',
  ErrFrozenBalanceInsufficient = '21103:冻结余额不足',
  ErrAmountInvalid = '21104:金额格式无效',
  ErrAmountTooLarge = '21105:金额超出最大限制',
  ErrAmountMustPositive = '21106:金额必须大于0',
  ErrWalletUpdateFailed = '21107:钱包记录更新异常',
  ErrOperationConflict = '21108:操作冲突，请稍后重试',

  // chain address (22xxx)
  ErrChainAddressNotFound = '22101:区块链地址不存在',
  ErrPrivateKeyStoreFailed = '22102:私钥存储失败',
  ErrPrivateKeyRetrieveFailed = '22103:私钥获取失败',
  ErrChainTypeNotSupported = '22104:不支持的区块链类型',

  // auth (23xxx)
  ErrAuthLogin = '23101:用户名或密码错误',
  ErrAuthUserDisabled = '23102:账号已被禁用',
  ErrAuthRefreshTokenInvalid = '23103:刷新令牌无效',
  ErrAuthRequireLogin = '23104:请先登录',

  // chain (24xxx)
  ErrChainNotFound = '24101:区块链不存在',
  ErrChainDisabled = '24102:区块链已禁用',
  ErrTokenNotFound = '24103:代币不存在',
  ErrTokenDisabled = '24104:代币已禁用',
  ErrChainNoTokens = '24105:该区块链暂无支持的代币',

  // market (25xxx)
  ErrMarketPriceNotFound = '25101:价格数据不存在',
  ErrMarketPriceUnavailable = '25102:无法获取实时价格',
  ErrMarketSymbolInvalid = '25103:交易对符号无效',
  ErrMarketApiTimeout = '25104:市场数据请求超时',
  ErrMarketNoTokens = '25105:系统暂无代币配置',

  // order-deposit (26xxx)
  ErrDepositNotFound = '26101:充值订单不存在',
  ErrDepositAlreadyProcessed = '26102:充值订单已处理',
  ErrDepositTransactionNotFound = '26103:充值交易未找到',

  // order-withdraw (27xxx)
  ErrWithdrawNotFound = '27101:提现订单不存在',
  ErrWithdrawPending = '27102:已有提现订单在处理中',
  ErrWithdrawTokenNotSupported = '27103:代币不支持提现',
  ErrWithdrawChainTokenNotFound = '27104:链上代币不存在',
  ErrWithdrawAmountInvalid = '27105:提现金额必须大于0',
  ErrWithdrawStatusInvalid = '27106:订单状态不正确',
  ErrWithdrawCancelForbidden = '27107:只能取消待审核状态的订单',

  // order-transfer (28xxx)
  ErrTransferUserNotFound = '28101:转入用户不存在',
  ErrTransferSelfForbidden = '28102:不能转账给自己',
  ErrTransferFromUserNotFound = '28103:转出用户不存在',
  ErrTransferTokenNotSupported = '28104:代币不支持转账',
  ErrTransferAmountInvalid = '28105:转账金额必须大于0',

  // order-swap (29xxx)
  ErrSwapSameToken = '29101:不能兑换相同的代币',
  ErrSwapFromTokenNotSupported = '29102:源代币不支持',
  ErrSwapToTokenNotSupported = '29103:目标代币不支持',
  ErrSwapAmountInvalid = '29104:兑换金额必须大于0',
  ErrSwapAmountTooSmall = '29105:兑换数量过小',

  // sys (30xxx)
  ErrSysWalletNotFound = '30101:系统钱包地址不存在',
  ErrSysWalletPrivateKeyFailed = '30102:获取私钥失败',
  ErrSysWalletPrivateKeyStoreFailed = '30103:私钥存储失败',
  ErrSysWalletDecryptionFailed = '30104:私钥解密失败',

  // transaction (31xxx)
  ErrTransactionNotFound = '31101:交易记录不存在',
  ErrTransactionAddressDeriveFailed = '31102:地址生成失败',
  ErrTransactionBalanceInsufficient = '31103:余额不足',
  ErrTransactionExecuteFailed = '31104:交易执行失败',

  // shared (32xxx)
  ErrSharedChainTypeNotSupported = '32101:不支持的区块链类型',
  ErrSharedDatabaseNotConfigured = '32102:数据库未配置',
}
