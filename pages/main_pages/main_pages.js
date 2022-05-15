var xBlufi = require("../../utils/blufi/xBlufi.js");
var _this = null;

//通过数组元素寻找下标函数
function getArrayIndex(array, str) {
	for (var i = 0; i < array.length; i++) {
		if (array[i] === str) {
			return i;
		}
	}
	return -1;
}

Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		//全局数据Data定义
		products: ["MediaStateBoard", "CloudMedicalKit", "自定义"],
		products_bluetooth_name: ["MediaStateBoard", "CloudMedicalKit"],
		chips: ["ESP32", "ESP32-C3", "ESP32-S2", "ESP32-S3"],
		bluetooth_name_list: [],
		bluetooth_deviceId_list: [],
		wifi_list: ["TestWiFi"],
		//状态定义
		bluetooth_searching: false,
		device_customization: false,
		button_dis_state: false,
		button_str: "开始连接",
		button_loading: false,
		//数据定义
		product_name_index: 0,
		product_name: "",
		chip_select_index: 0,
		chip_name: "",
		bluetooth_select_index: 0,
		bluetooth_id: "",
		bluetooth_name: "",
		wifi_ssid_index: 0,
		wifi_ssid: "",
		wifi_pwd: "",
		user_custom_data: "",
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad(options) {
		_this = this;

		//abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRESTUVWXYZ1234567890,./;'`-=~!@#$%%^&*()_+{}:"<>?[]\|踏雪无痕 项目已开源 特别感谢 半颗心脏 主页 关于 产品选择 蓝牙选择 WIFI名称  密码输入 自定义 の 工具箱 所属

		//设置字体
		wx.loadFontFace({
			family: "alifont",
			source: 'url("https://at.alicdn.com/t/webfont_5f4sxhxvp76.ttf")',
		});

		//获取已连接WIFI名称
		wx.startWifi({
			success: (res) => {
				wx.getConnectedWifi({
					success: (result) => {
						if (result.wifi.SSID.indexOf("5G") == -1) {
							_this.setData({
								wifi_ssid: result.wifi.SSID,
								wifi_list: [result.wifi.SSID], //这里WXML需要数组形式进行显示
								wifi_pwd: wx.getStorageSync('result.wifi.SSID'),//从缓存获取对应的WIFI密码
							})
							console.log(_this.data.wifi_ssid, "Storage PWD:", _this.data.wifi_pwd);
						} else {
							wx.showToast({
								title: '请切换2.4G网络',
								icon: 'none',
								duration: 3000
							})
						}
					},
				})
			},
		})

		//检测蓝牙授权
		wx.getSetting({
			success: (res) => {
				console.log(res.authSetting)
				//判断是不是有'scope.bluetooth'属性
				if (res.authSetting.hasOwnProperty('scope.bluebooth')) {
					//如果属性存在，并且为false的话，对其进行弹窗授权
					if (!res.authSetting['scpoe.bluetooth']) {
						wx.openSetting({
							success: (res) => {
								console.log(res.authSetting)
							}
						})
					}
				} else {
					//scope.bluetootch属性不存在，需要进行授权
					wx.authorize({
						scope: 'scope.bluetooth',
						success: () => {
							//用户已经同意小程序使用手机蓝牙功能，后续调用不会弹窗询问
							console.log(res.authSetting)
						}
					})
				}
			}
		})

		//启用xBlufi核心
		xBlufi.initXBlufi(1); //指定为微信小程序使用
		console.log("xBlufi", xBlufi.XMQTT_SYSTEM);
		xBlufi.listenDeviceMsgEvent(true, _this.funListenDeviceMsgEvent); //设置设备监听信息事件
	},

	funListenDeviceMsgEvent: function (options) {
		switch (options.type) {
			case xBlufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS: //获取列表
				if (options.result) {
					for (let i = 0; i < options.data.length; i++) {
						//筛选name不是空的设备加入到设备列表里面
						if (options.data[i].name != "") {
							//查找是不是加入过了
							if (!_this.data.bluetooth_name_list.includes(options.data[i].name)) {
								//这两个必须一起加进去，便于定位数据
								_this.data.bluetooth_name_list.push(options.data[i].name);
								_this.data.bluetooth_deviceId_list.push(options.data[i].deviceId);
							}
						}
					}
					_this.setData({
						bluetooth_name_list: _this.data.bluetooth_name_list,
						//将下标为0的蓝牙设备赋值给变量
						bluetooth_name: _this.data.bluetooth_name_list[_this.data.bluetooth_select_index],
						bluetooth_id: _this.data.bluetooth_deviceId_list[_this.data.bluetooth_select_index],
						//按钮状态改变
						button_str: "正在搜索蓝牙...",
						button_loading: true,
						button_dis_state: true
					})
					console.log(_this.data.bluetooth_name_list, _this.data.bluetooth_deviceId_list);

					//判断是不是自定义设备，如果是的话直接显示"开始连接"
					if (_this.data.device_customization) {
						_this.setData({
							//按钮状态改变
							button_str: "开始连接",
							button_loading: false,
							button_dis_state: false
						})
					}

					//对于停止搜索的时机进行判断,如果包含被定义的设备名称，那么就停止搜索
					if (!_this.data.device_customization) {
						//蓝牙名称和设备名称的index是相同的，所以直接用设备名称下标查找
						if (_this.data.bluetooth_name_list.includes(_this.data.products_bluetooth_name[_this.data.product_name_index])) {
							if (_this.data.bluetooth_searching) {
								/*注意这里有一个小bug但是不影响使用，如果是使用已经定义好了的产品，由于目前处在列表搜索的case中
								列表不停的更新，从而带来的就是多次发送停止搜索命令，多次发送停止搜索命令又会到达已经停止的case中，
								（具体详见下面的case），这样的话就会引发多次发送连接请求，但是不影响使用，设备只会选择一个进行连接，
								看到蓝牙连接错的的报错也没事儿，只要有一个连接到稍等一会儿就会看到连接成功的显示了；如果是自定义设备
								由于逻辑问题则不存在此问题，自定义设备通知连接的代码并不在此处*/
								xBlufi.notifyStartDiscoverBle({ 'isStart': false });
							}
						}
					}
				}
				break;

			case xBlufi.XBLUFI_TYPE.TYPE_CONNECTED: //是否连接成功
				console.log("连接回调:", JSON.stringify(options));
				if (options.result) {
					console.log("蓝牙连接成功, 准备发送ESP初始化配置信息...");
					wx.showToast({ title: "蓝牙连接成功", icon: "none" });
					_this.setData({
						//按钮状态改变
						button_str: "蓝牙连接成功, 准备发送ESP初始化配置信息...",
						button_loading: true,
						button_dis_state: true
					})

					//蓝牙连接成功后初始化ESP相关配置
					xBlufi.notifyInitBleEsp32({
						deviceId: options.data.deviceId //使用options的data，防止用户误操作滑块造成deviceid不匹配
					})
				} else {
					console.log("蓝牙连接失败!");
					wx.showToast({ title: "蓝牙连接失败", icon: "none" });
				}
				break;

			case xBlufi.XBLUFI_TYPE.TYPE_INIT_ESP32_RESULT://初始化ESP配置结果
				console.log("初始化结果: ", JSON.stringify(options));//深拷贝
				if (options.result) {
					console.log("ESP配置初始化成功, 准备发送WIFI信息...");
					console.log("WIFI配置信息:", _this.data.wifi_ssid, _this.data.wifi_pwd);
					_this.setData({
						//按钮状态改变
						button_str: "ESP配置初始化成功...准备发送WIFI信息...",
						button_loading: true,
						button_dis_state: true
					});

					//初始化成功之后发送WIFI名称和密码
					xBlufi.notifySendRouterSsidAndPassword({
						ssid: _this.data.wifi_ssid,
						password: _this.data.wifi_pwd,
					});
				} else {
					wx.showModal({
						title: '初始化失败',
						content: '请尝试重启设备',
						showCancel: false,
						confirmText: '确定',
						confirmColor: '#e74033',
					});
				}
				break;

			case xBlufi.XBLUFI_TYPE.TYPE_CONNECT_ROUTER_RESULT:
				if (options.result) {
					if (options.data.progress == 100) {
						console.log("WIFI配置成功...");

						//将密码存储，用户第二次使用的时候自动填写
						wx.setStorageSync('_this.data.wifi_ssid', '_this.data.wifi_pwd');

						//发送用户自定义的数据, 在连接了ESP蓝牙之后，任何时候都可以调用
						if (_this.data.user_custom_data) {
							console.log("发送用户自定义数据...", _this.data.user_custom_data);
							xBlufi.notifySendCustomData({
								customData: _this.data.user_custom_data,
							});
						}

						wx.showModal({
							title: '配网成功',
							content: `成功连接到WIFI [${options.data.ssid}]`, //注意这里不是字符串
							showCancel: false,
							confirmText: '确定',
							confirmColor: '#fbad32',
							success: (result) => {
								_this.setData({
									//按钮状态改变
									button_str: "开始连接", //连接成功所以回归原始状态
									button_loading: false,
									button_dis_state: false
								});

								//跳转到关于页面
								wx.switchTab({ url: '../about_me/about_me' });
							},
						});
					} else {
						console.log("WIFI配置失败!");
						wx.showModal({
							title: '配网失败',
							content: '请尝试重启被配网设备, 或检查WIFI密码是否正确',
							showCancel: false,
							confirmText: '确定',
							confirmColor: '#e74033',
						});
					}
				}
				break;

			//接收到来自设备的自定义信息, CUSTON好像是拼写错误，当用户发送自定义数据的时候，设备默认会将数据原样返回,不能解析汉字
			case xBlufi.XBLUFI_TYPE.TYPE_RECIEVE_CUSTON_DATA:
				console.log("收到来自设备的自定义数据: ", options.data);
				wx.showModal({
					title: "来自设备的自定义数据",
					content: `${options.data}`,
					showCancel: false,
					confirmColor: '#fbad32',
				})
				break;

			case xBlufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_START: //获取设备列表前动作
				if (!options.result) {
					console.log("蓝牙未开启: ", options);
					wx.showToast({ title: "蓝牙未开启", icon: "none" });
				} else {
					console.log("蓝牙已正常打开");
					_this.setData({ bluetooth_searching: true });
				}
				break;

			case xBlufi.XBLUFI_TYPE.TYPE_STATUS_CONNECTED: //连接状态检测
				if (!options.result) {
					wx.showModal({
						title: "蓝牙连接断开",
						content: "请重新配网",
						showCancel: false,
						confirmColor: '#e74033',
						success: (result) => {
							_this.setData({
								//按钮状态改变
								button_str: "开始连接", //连接失败重新配网回归原始状态
								button_loading: false,
								button_dis_state: false
							});
						}
					})
				}
				break;

			case xBlufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_STOP: //蓝牙搜索设备是否停止
				if (options.result) {
					console.log("蓝牙已停止搜索");
					_this.setData({ bluetooth_searching: false });

					//蓝牙停止搜索之后发起连接请求
					if (!_this.data.device_customization) {
						//如果是已经定义了产品蓝牙设备则需要进一步处理
						//在可用的蓝牙列表里寻找出已经定义产品蓝牙名称的下标
						let ble_list_index = getArrayIndex(_this.data.bluetooth_name_list, _this.data.products_bluetooth_name[_this.data.product_name_index]);
						if (ble_list_index < 0) {
							console.log("未找到产品对应的蓝牙设备!");
						} else {
							let name = _this.data.bluetooth_name_list[ble_list_index]; //获取对应下标名称
							let ble_id = _this.data.bluetooth_deviceId_list[ble_list_index]; //获取对应下标ID
							xBlufi.notifyConnectBle({
								isStart: true,
								deviceId: ble_id,
								name
							});

							_this.setData({
								//按钮状态改变
								button_str: "开始连接蓝牙...",
								button_loading: true,
								button_dis_state: true
							})
						}
					} else {
						//产品自定义用data中的数据直接连接
						let name = _this.data.bluetooth_name
						xBlufi.notifyConnectBle({
							isStart: true,
							deviceId: _this.data.bluetooth_id,
							name
						});
						console.log(_this.data.bluetooth_name, _this.data.bluetooth_id);

						_this.setData({
							//按钮状态改变
							button_str: "开始连接蓝牙...",
							button_loading: true,
							button_dis_state: true
						})
					}
				} else {
					console.log("蓝牙无法停止搜索");
				}
				break;
		}
	},

	product_Change: function (e) {
		_this.setData({
			product_name_index: e.detail.value,
			product_name: _this.data.products[e.detail.value],
		})

		if (_this.data.product_name == "自定义") {
			_this.setData({
				device_customization: true,
			})

			//开始搜索蓝牙
			xBlufi.notifyStartDiscoverBle({ 'isStart': true });
		} else {
			if (_this.data.bluetooth_searching) {
				xBlufi.notifyStartDiscoverBle({ 'isStart': false });
			}

			//让其他方块隐藏
			_this.setData({
				device_customization: false,
			})
		}
	},

	chip_Change: function (e) {
		_this.setData({
			chip_select_index: e.detail.value,
			chip_name: _this.data.chips[e.detail.value]
		})
	},

	bluetooth_Change: function (e) {
		_this.setData({
			bluetooth_select_index: e.detail.value,
			bluetooth_id: _this.data.bluetooth_deviceId_list[e.detail.value],
			bluetooth_name: _this.data.bluetooth_name_list[e.detail.value]
		})
	},

	wifi_name_Change: function (e) {
		_this.setData({
			wifi_ssid_index: e.detail.value,//当前WIFI只有一个
			wifi_ssid: wifi_list[e.detail.value]
		})
	},

	pwd_input: function (e) {
		_this.setData({
			wifi_pwd: e.detail.value,
		})
	},

	custom_text: function (e) {
		_this.setData({
			user_custom_data: e.detail.value,
		})
	},

	start_connect: function () {
		if (_this.data.wifi_pwd) {
			if (_this.data.device_customization) {
				//自定义的话自动搜索，点击连接就停止搜索
				if (_this.data.bluetooth_searching) {
					xBlufi.notifyStartDiscoverBle({
						'isStart': false
					})
				}
			} else {
				//如果是选择了特定产品，那么点击开始的时候才开始搜索
				if (_this.data.bluetooth_searching) {
					xBlufi.notifyStartDiscoverBle({ 'isStart': false })
				} else {
					xBlufi.notifyStartDiscoverBle({ 'isStart': true })
				}
			}
		} else {
			wx.showToast({ title: "请输入WIFI密码", icon: "none" });
		}

	},

	/**
	 * 生命周期函数--监听页面卸载
	 */
	onUnload() {
		xBlufi.listenDeviceMsgEvent(false, _this.funListenDeviceMegEvent);
	}
})