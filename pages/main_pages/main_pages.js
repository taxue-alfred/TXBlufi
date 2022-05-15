var xBlufi = require("../../utils/blufi/xBlufi.js");
var _this = null;

Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		//全局数据Data定义
		products: ["MediaStateBoard", "CloudMedicalKit", "自定义"],
		products_bludetooth_name: ["MediaStateBoard", "CloudMedicalKit"],
		chips: ["ESP32", "ESP32-C3", "ESP32-S2", "ESP32-S3"],
		bluetooth_name_list: [],
		bluetooth_deviceId_list: [],
		wifi_list: ["TestWiFi"],
		//状态定义
		bluetooth_searching: false,
		device_customization: false,
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
						bluetooth_id: _this.data.bluetooth_deviceId_list[_this.data.bluetooth_select_index]
					})
					console.log(_this.data.bluetooth_name_list, _this.data.bluetooth_deviceId_list);
				}
				break;

			case xBlufi.XBLUFI_TYPE.TYPE_CONNECTED: //是否连接成功
				console.log("连接回调:", JSON.stringify(options));
				if (options.result) {
					console.log("蓝牙连接成功, 准备发送ESP初始化配置信息...");
					wx.showToast({ title: "蓝牙连接成功", icon: "none" });

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
								//跳转到关于页面
								wx.switchTab({ url: '../about_me/about_me' });
							},
						});
					} else {
						console.log("WIFI配置失败!");
						wx.showModal({
							title: '配网失败',
							content: '请尝试重启设备, 或者检查WIFI密码是否正确',
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
					console.log("蓝牙未开启 => ", options);
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
					})
				}
				break;

			case xBlufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_STOP: //蓝牙搜索设备是否停止
				if (options.result) {
					console.log("蓝牙已停止搜索");
				} else {
					console.log("蓝牙无法停止搜索");
				}
				_this.setData({ bluetooth_searching: false });
				break;
		}
	},

	product_Change: function (e) {
		_this.setData({
			product_name_index: e.detail.value,
			product_name: _this.data.products[e.detail.value]
		})

		if (_this.data.product_name == "自定义") {
			_this.setData({
				device_customization: true,
			})
		} else {
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

	start_search: function () {
		//开始蓝牙搜索
		if (_this.data.searching) {
			xBlufi.notifyStartDiscoverBle({ 'isStart': false })
		} else {
			xBlufi.notifyStartDiscoverBle({ 'isStart': true })
		}
	},

	start_connect: function () {
		if (_this.data.wifi_pwd) {
			//停止搜索
			xBlufi.notifyStartDiscoverBle({
				'isStart': false
			})

			let name = _this.data.bluetooth_name
			xBlufi.notifyConnectBle({
				isStart: true,
				deviceId: _this.data.bluetooth_id,
				name
			});
			console.log(_this.data.bluetooth_name, _this.data.bluetooth_id)
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