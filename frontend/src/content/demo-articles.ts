export type ArticleTable = {
  caption: string
  headers: string[]
  rows: string[][]
}

export type ArticleSection = {
  id: string
  title: string
  paragraphs?: string[]
  list?: string[]
  note?: string
  code?: string
  table?: ArticleTable
  waveform?: 'power-drop' | 'serial'
}

export type DemoArticle = {
  applicability: string
  safety?: string
  checklist: string[]
  sections: ArticleSection[]
}

export const demoArticles: Record<string, DemoArticle> = {
  无法上电: {
    applicability:
      '适用于低压直流供电的单片机最小系统、传感器模块和常见数字电路。',
    safety:
      '测量电阻、通断或重新焊接前必须断电。若电路包含市电、高压或大容量电容，请由具备资质的人员处理。',
    checklist: [
      '电源输出电压和限流值是否正确',
      '供电极性、连接器方向和公共地是否正确',
      '主电源轨对地是否存在明显短路',
      '使能、复位和启动模式引脚是否处于有效状态',
    ],
    sections: [
      {
        id: 'phenomenon',
        title: '现象描述',
        paragraphs: [
          '接通电源后指示灯、串口和程序均无响应，或者电源立即进入限流。排查时先区分“电源没有送到板上”和“电源正常但系统没有启动”。',
        ],
      },
      {
        id: 'input-power',
        title: '检查输入供电',
        paragraphs: [
          '先在电源端和电路板输入端分别测量电压。两处读数不同，通常说明线材、接插件、保险丝或开关存在问题。',
        ],
        list: [
          '确认电源额定电压、限流值和极性。',
          '带电测量输入端电压，观察上电瞬间是否塌陷。',
          '检查公共地是否真实连接，而不是只在原理图中同名。',
        ],
      },
      {
        id: 'short-circuit',
        title: '断电检查短路',
        paragraphs: [
          '完全断电并等待电容放电后，测量主电源轨对地电阻。不要仅凭蜂鸣档的一声提示判断短路，应观察读数是否会随电容充电逐渐上升。',
        ],
        note:
          '若电源一上电就限流，优先检查反接器件、焊锡桥、封装方向和电源芯片输出端。',
      },
      {
        id: 'startup',
        title: '检查启动条件',
        paragraphs: [
          '电源轨稳定后，继续确认复位、使能、时钟和启动模式。对于 MCU，先观察复位脚和系统时钟，再使用最小程序排除外设初始化导致的卡死。',
        ],
      },
      {
        id: 'verification',
        title: '修复验证',
        list: [
          '空载和典型负载下的电源轨均处于设计范围。',
          '连续重复上电十次，系统都能进入预期状态。',
          '记录故障器件、测量点和最终根因，便于后续复现。',
        ],
      },
    ],
  },
  电压或电流异常: {
    applicability:
      '适用于线性稳压器、DC-DC、电池供电模块以及常见模拟和数字负载。',
    safety:
      '改变接线或测量电阻前先断电。涉及电池、大电流或高压输入时，应使用限流电源和合适量程的仪表。',
    checklist: [
      '输入电压是否留有足够压差',
      '电源限流值是否低于实际负载需求',
      '输出电容的容量、ESR 和位置是否符合要求',
      '反馈网络、采样地和功率地是否连接正确',
    ],
    sections: [
      {
        id: 'phenomenon',
        title: '现象描述',
        paragraphs: [
          '空载时输出正常，接入负载后电压明显下降；或者静态电压正确，但负载变化时出现较大纹波、振荡和瞬态跌落。',
        ],
      },
      {
        id: 'input-margin',
        title: '确认输入余量',
        paragraphs: [
          '同时测量稳压器输入端和输出端，不要只读取电源面板。线材压降、连接器接触电阻和输入滤波器都会减少实际压差。',
        ],
        code:
          'Vin(min) > Vout + Vdropout + Vmargin\n\n空载  Vin = 12.08 V\n负载  Vin = 10.21 V\n瞬时压降   = 1.87 V',
      },
      {
        id: 'current-limit',
        title: '检查限流与负载',
        paragraphs: [
          '将负载电流逐步增加并记录输出变化。如果电压在某一电流点突然下降，同时输入电流不再增加，通常需要检查电源限流或器件保护。',
        ],
        table: {
          caption: '负载变化记录示例',
          headers: ['负载', '输出电压', '输入电压', '观察'],
          rows: [
            ['空载', '5.02 V', '7.80 V', '稳定'],
            ['0.5 A', '4.98 V', '7.74 V', '稳定'],
            ['1.0 A', '4.52 V', '7.61 V', '出现压降'],
          ],
        },
      },
      {
        id: 'stability',
        title: '观察纹波与瞬态',
        paragraphs: [
          '示波器探头应使用短地弹簧并直接测量输出电容两端。长接地线会把环境噪声误认为电源纹波。',
        ],
        waveform: 'power-drop',
        note:
          '先确认测量方法，再判断电路是否振荡。记录时注明探头带宽、耦合方式、负载和时间尺度。',
      },
      {
        id: 'verification',
        title: '修复验证',
        list: [
          '在最小、典型和最大负载下记录稳态电压。',
          '重复负载阶跃，确认过冲、跌落和恢复时间满足要求。',
          '连续运行并检查器件温升与保护状态。',
        ],
      },
    ],
  },
  通信失败或乱码: {
    applicability:
      '适用于 UART、I²C、SPI 等板级数字通信，以及模块之间的常见串行连接。',
    safety:
      '连接两个独立供电系统前先确认电平标准和公共地，避免把 5 V 信号直接接入不耐压的 3.3 V 引脚。',
    checklist: [
      '双方是否共地，TX/RX 或数据方向是否正确',
      '逻辑电平和上拉电压是否兼容',
      '波特率、数据位、校验位和停止位是否一致',
      '引脚复用、片选和设备地址是否配置正确',
    ],
    sections: [
      {
        id: 'phenomenon',
        title: '现象描述',
        paragraphs: [
          '单个模块测试正常，整机连接后无法收发、偶发丢包或持续出现乱码。排查应先从物理连接和波形开始，再检查协议参数与软件状态。',
        ],
      },
      {
        id: 'physical-layer',
        title: '先看物理连接',
        list: [
          'UART 交叉连接 TX 与 RX，并确认双方共地。',
          'I²C 检查 SDA、SCL 上拉电阻和总线空闲电平。',
          'SPI 检查片选极性、时钟模式和数据方向。',
        ],
      },
      {
        id: 'signal',
        title: '测量真实波形',
        paragraphs: [
          '不要只根据程序日志判断总线是否工作。使用示波器或逻辑分析仪观察是否有跳变、幅值是否达到逻辑门限、边沿是否过慢。',
        ],
        waveform: 'serial',
      },
      {
        id: 'parameters',
        title: '核对通信参数',
        paragraphs: [
          '将双方配置逐项写在同一张记录中。对于 UART，时钟误差会直接影响波特率；对于 I²C 和 SPI，还需要确认地址、时钟模式和事务边界。',
        ],
        note:
          '先使用低速、短线和最小数据帧建立稳定通信，再逐步恢复目标速率和完整协议。',
      },
      {
        id: 'verification',
        title: '修复验证',
        list: [
          '连续发送固定数据和递增序列，统计错误与丢包。',
          '在整机运行、负载切换和电机动作时重复测试。',
          '保存一份正常波形，作为后续联调的对照基准。',
        ],
      },
    ],
  },
}
