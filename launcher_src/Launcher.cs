using System;
using System.Diagnostics;
using System.Threading;
using System.IO;
using System.Net.NetworkInformation;
using System.Linq;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Drawing;
using Microsoft.Web.WebView2.WinForms;
using Microsoft.Web.WebView2.Core;
using System.Threading.Tasks;
using Microsoft.Win32;

class Launcher : Form {
    [DllImport("shell32.dll", SetLastError = true)]
    static extern int SetCurrentProcessExplicitAppUserModelID([MarshalAs(UnmanagedType.LPWStr)] string AppID);

    private WebView2 webView;
    private Process serverProcess;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct DISPLAY_DEVICE {
        [MarshalAs(UnmanagedType.U4)]
        public int cb;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string DeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceString;
        [MarshalAs(UnmanagedType.U4)]
        public int StateFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
        public string DeviceKey;
    }

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern bool EnumDisplayDevices(string lpDevice, uint iDevNum, ref DISPLAY_DEVICE lpDisplayDevice, uint dwFlags);

    [STAThread]
    static void Main() {
        SetCurrentProcessExplicitAppUserModelID("PyeongHaeng.00Hub.Launcher");
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new Launcher());
    }

    private NotifyIcon trayIcon;
    private ContextMenu trayMenu;
    private MenuItem monitorMenu;

    public Launcher() {
        this.Text = "00Hub.";
        this.FormBorderStyle = FormBorderStyle.None; // 테두리 제거
        this.WindowState = FormWindowState.Maximized; // 전체화면
        this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        // this.TopMost = true; // Alt+Tab 전환을 위해 상시 TopMost는 제거
        this.ShowInTaskbar = false; // 작업 표시줄에서 숨김

        InitializeTrayIcon();

        // 0. Set Current Working Directory to Application path
        Directory.SetCurrentDirectory(AppDomain.CurrentDomain.BaseDirectory);

        // 1. Kill existing port 23500 if busy
        KillPort(23500);

        // 2. Register to Startup (Optional but requested)
        RegisterStartup();

        // 3. Start npm run dev hidden
        StartServer();

        // 4. Initialize WebView2
        InitializeWebView();
    }

    private void InitializeTrayIcon() {
        trayMenu = new ContextMenu();
        trayMenu.MenuItems.Add("00Hub. 열기", (s, e) => {
            this.WindowState = FormWindowState.Minimized; // 강제 갱신용
            this.WindowState = FormWindowState.Maximized;
            this.Show();
            this.Activate();
        });

        // 모니터 이동 서브메뉴 추가 (동적으로 생성될 예정)
        monitorMenu = new MenuItem("모니터 이동");
        UpdateMonitorMenu();
        trayMenu.MenuItems.Add(monitorMenu);

        // 디스플레이 설정 변경 감지 이벤트 등록
        SystemEvents.DisplaySettingsChanged += (s, e) => {
            this.BeginInvoke((MethodInvoker)delegate {
                UpdateMonitorMenu();
            });
        };

        trayMenu.MenuItems.Add("-"); // 구분선
        trayMenu.MenuItems.Add("완전 종료", (s, e) => {
            Application.Exit();
        });

        trayIcon = new NotifyIcon();
        trayIcon.Text = "00Hub.";
        trayIcon.Icon = this.Icon;
        trayIcon.ContextMenu = trayMenu;
        trayIcon.Visible = true;

        trayIcon.DoubleClick += (s, e) => {
            this.WindowState = FormWindowState.Maximized;
            this.Show();
            this.Activate();
        };
    }

    private void UpdateMonitorMenu() {
        if (monitorMenu == null) return;
        
        monitorMenu.MenuItems.Clear();
        for (int i = 0; i < Screen.AllScreens.Length; i++) {
            int index = i;
            Screen screen = Screen.AllScreens[i];
            
            string friendlyName = GetMonitorFriendlyName(screen.DeviceName);
            string label = string.Format("모니터 {0}: {1} ({2})", i + 1, friendlyName, screen.Primary ? "주" : "보조");
            
            monitorMenu.MenuItems.Add(label, (s, e) => {
                MoveToMonitor(index);
            });
        }
    }

    private string GetMonitorFriendlyName(string deviceName) {
        DISPLAY_DEVICE device = new DISPLAY_DEVICE();
        device.cb = Marshal.SizeOf(device);
        
        // 1. Get the device info
        if (EnumDisplayDevices(deviceName, 0, ref device, 0)) {
            // 2. Get the monitor info (second call with device.DeviceName)
            DISPLAY_DEVICE monitor = new DISPLAY_DEVICE();
            monitor.cb = Marshal.SizeOf(monitor);
            if (EnumDisplayDevices(device.DeviceName, 0, ref monitor, 0)) {
                return monitor.DeviceString;
            }
            return device.DeviceString;
        }
        return "알 수 없는 모니터";
    }

    private void MoveToMonitor(int index) {
        if (index >= 0 && index < Screen.AllScreens.Length) {
            Screen targetScreen = Screen.AllScreens[index];
            this.WindowState = FormWindowState.Normal;
            this.StartPosition = FormStartPosition.Manual;
            this.Location = targetScreen.Bounds.Location;
            this.Size = targetScreen.Bounds.Size;
            this.WindowState = FormWindowState.Maximized;
        }
    }

    private void RegisterStartup() {
        try {
            string appName = "00Hub";
            // 경로에 공백이 있으므로 따옴표로 감싸야 윈도우가 정확히 인식함
            string appPath = "\"" + Application.ExecutablePath + "\"";
            using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Run", true)) {
                if (key != null) {
                    key.SetValue(appName, appPath);
                }
            }
        } catch {}
    }

    private void StartServer() {
        ProcessStartInfo serverInfo = new ProcessStartInfo {
            FileName = "cmd.exe",
            Arguments = "/c npm run dev",
            WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory,
            WindowStyle = ProcessWindowStyle.Hidden,
            CreateNoWindow = true,
            UseShellExecute = false
        };
        serverProcess = Process.Start(serverInfo);
    }

    private async void InitializeWebView() {
        webView = new WebView2();
        webView.Dock = DockStyle.Fill;
        this.Controls.Add(webView);

        try {
            await webView.EnsureCoreWebView2Async(null);
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false; 
            
            webView.CoreWebView2.ContainsFullScreenElementChanged += (sender, args) => {
                this.BeginInvoke((MethodInvoker)delegate {
                    // 상시 전체화면 형태 유지하되 Alt+Tab 방해하지 않음
                    this.FormBorderStyle = FormBorderStyle.None;
                    this.WindowState = FormWindowState.Maximized;
                });
            };

            webView.CoreWebView2.WebMessageReceived += (sender, args) => {
                string message = args.TryGetWebMessageAsString();
                if (message == "minimize" || message == "close") {
                    this.BeginInvoke((MethodInvoker)delegate {
                        this.WindowState = FormWindowState.Minimized;
                    });
                } else if (message == "topmost:true") {
                    this.BeginInvoke((MethodInvoker)delegate {
                        this.TopMost = true;
                    });
                } else if (message == "topmost:false") {
                    this.BeginInvoke((MethodInvoker)delegate {
                        this.TopMost = false;
                    });
                }
            };

            // Wait for server to be ready with a bit more buffer for startup
            await Task.Delay(5000);
            webView.Source = new Uri("http://localhost:23500");
        } catch (Exception ex) {
            MessageBox.Show("WebView2 초기화 실패: " + ex.Message);
        }
    }

    protected override void OnFormClosing(FormClosingEventArgs e) {
        // Close server process tree when window is closed
        if (serverProcess != null && !serverProcess.HasExited) {
            KillProcessAndChildren(serverProcess.Id);
        }
        base.OnFormClosing(e);
    }

    private void KillProcessAndChildren(int pid) {
        try {
            Process.Start(new ProcessStartInfo {
                FileName = "taskkill.exe",
                Arguments = string.Format("/f /t /pid {0}", pid),
                WindowStyle = ProcessWindowStyle.Hidden,
                CreateNoWindow = true
            }).WaitForExit();
        } catch {}
    }

    static void KillPort(int port) {
        try {
            Process p = new Process();
            p.StartInfo.FileName = "netstat.exe";
            p.StartInfo.Arguments = "-aon";
            p.StartInfo.UseShellExecute = false;
            p.StartInfo.RedirectStandardOutput = true;
            p.StartInfo.CreateNoWindow = true;
            p.Start();
            string output = p.StandardOutput.ReadToEnd();
            p.WaitForExit();

            string[] lines = output.Split(new[] { Environment.NewLine }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines) {
                if (line.Contains(":" + port) && line.Contains("LISTENING")) {
                    string[] parts = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                    string pid = parts.Last();
                    Process.Start(new ProcessStartInfo {
                        FileName = "taskkill.exe",
                        Arguments = string.Format("/f /pid {0}", pid),
                        WindowStyle = ProcessWindowStyle.Hidden,
                        CreateNoWindow = true
                    }).WaitForExit();
                }
            }
        } catch {}
    }
}
