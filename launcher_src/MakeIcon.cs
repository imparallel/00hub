using System;
using System.IO;

class MakeIcon {
    static void Main(string[] args) {
        if (args.Length < 2) return;
        string pngPath = args[0];
        string icoPath = args[1];

        byte[] pngData = File.ReadAllBytes(pngPath);
        
        using (BinaryWriter iconWriter = new BinaryWriter(File.Open(icoPath, FileMode.Create))) {
            // ICO Header
            iconWriter.Write((short)0);      // Reserved
            iconWriter.Write((short)1);      // Type (1 = Icon)
            iconWriter.Write((short)1);      // Count

            // Icon Directory Entry
            iconWriter.Write((byte)0);       // Width (0 means 256) -> Modern icons can use 256, but let's be safe
            iconWriter.Write((byte)0);       // Height (0 means 256)
            iconWriter.Write((byte)0);       // Color count
            iconWriter.Write((byte)0);       // Reserved
            iconWriter.Write((short)1);      // Planes
            iconWriter.Write((short)32);     // Bit count
            iconWriter.Write((int)pngData.Length); // Size of image data
            iconWriter.Write((int)22);       // Offset (6 bytes header + 16 bytes entry = 22)

            // Image Data (PNG format is valid in ICO)
            iconWriter.Write(pngData);
        }
    }
}
