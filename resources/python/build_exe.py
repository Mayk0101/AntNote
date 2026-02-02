"""
Build script para compilar antagonista.py em executável
Execute: python build_exe.py
"""
import subprocess
import os
import shutil

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(script_dir, 'antagonista.py')
    
    print("=== Compilando antagonista.py com PyInstaller ===")
    
    cmd = [
        'pyinstaller',
        '--onefile',
        '--console',
        '--name', 'antagonista',
        '--distpath', script_dir,
        '--workpath', os.path.join(script_dir, 'build'),
        '--specpath', os.path.join(script_dir, 'build'),
        '--clean',
        script_path
    ]
    
    result = subprocess.run(cmd, cwd=script_dir)
    
    if result.returncode == 0:
        print("\n✓ Build concluído com sucesso!")
        print(f"✓ Executável criado em: {os.path.join(script_dir, 'antagonista.exe')}")
        
        # Limpar pasta build
        build_dir = os.path.join(script_dir, 'build')
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)
            print("✓ Pasta build limpa")
    else:
        print("\n✗ Erro no build")
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())
