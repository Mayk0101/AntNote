
import os
import sys
import subprocess
import shutil
import json
import time
import glob

def run_command(command, cwd=None):
    """Executa um comando e retorna o resultado detalhado"""
    print(f"Executando comando: {command}")
    try:
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=cwd
        )
        stdout, stderr = process.communicate()
        
        print("\nSaída do comando:")
        if stdout:
            print(stdout)
        if stderr:
            print("Erros encontrados:")
            print(stderr)
            
        return process.returncode == 0
    except Exception as e:
        print(f"Erro ao executar comando: {e}")
        return False

def remove_license_files(dist_dir):
    """Remove arquivos de licença indesejados do diretório de distribuição"""
    print("Removendo arquivos de licença indesejados...")
    license_patterns = [
        "LICENSE.chromium*",
        "LICENSE.electron*",
        "LICENSES.chromium*",
        "LICENSE.txt",
        "LICENSE",
        "license.txt",
        "*.licenses",
        "license",
        "LICENCE*"
    ]
    
    try:
        for pattern in license_patterns:
            for file in glob.glob(os.path.join(dist_dir, "**", pattern), recursive=True):
                try:
                    if os.path.isfile(file):
                        os.remove(file)
                        print(f"Removido: {file}")
                    elif os.path.isdir(file):
                        shutil.rmtree(file)
                        print(f"Removido diretório: {file}")
                except Exception as e:
                    print(f"Erro ao remover {file}: {e}")
    except Exception as e:
        print(f"Erro ao remover arquivos de licença: {e}")

def clean_node_modules():
    """Limpa módulos desnecessários do node_modules mantendo os essenciais"""
    try:
        node_modules = os.path.join(os.getcwd(), "node_modules")
        if os.path.exists(node_modules):
            # Lista de diretórios para remover (mais conservadora)
            to_remove = [
                "*/.github/*",
                "*/docs/*",
                "*/.idea/*",
                "*/.vscode/*",
                "*/typescript/*",
                "*/.git/*",
                "*/benchmark/*",
                "*/coverage/*",
                "*/LICENSE*",
                "*/LICENCE*",
                "*/license*",
                "*/README*",
                "*/test/*",
                "*/tests/*",
                "*/example/*",
                "*/examples/*"
            ]
            
            # Lista de arquivos para manter
            to_keep = [
                "*/package.json",
                "*/index.js",
                "*/lib/*",
                "*/dist/*",
                "*/build/*",
                "*/bin/*",
                "*/conf/*",
                "*/config/*",
                "*/src/*"
            ]
            
            print("Removendo arquivos desnecessários do node_modules...")
            
            # Primeiro, criar uma lista de arquivos para manter
            keep_files = []
            for pattern in to_keep:
                path = os.path.join(node_modules, pattern)
                keep_files.extend([f for f in glob.glob(path, recursive=True)])
            
            # Depois, remover apenas os diretórios desnecessários
            for pattern in to_remove:
                path = os.path.join(node_modules, pattern)
                files_to_remove = [f for f in glob.glob(path, recursive=True) if f not in keep_files]
                for file in files_to_remove:
                    try:
                        if os.path.isdir(file):
                            shutil.rmtree(file, ignore_errors=True)
                        else:
                            os.remove(file)
                    except:
                        pass
            
            print("Limpeza do node_modules concluída")
            return True
    except Exception as e:
        print(f"Erro ao limpar node_modules: {e}")
        return False

def main():
    print("Criando executável do AntNote")
    
    # Obter o diretório do aplicativo (onde está este script)
    app_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(app_dir)  # Mudar para o diretório do aplicativo
    
    print(f"Diretório do script: {app_dir}")

    # Matar processos antigos que possam estar travando arquivos
    print("Finalizando processos antigos...")
    run_command('taskkill /F /IM "electron.exe" /T')
    run_command('taskkill /F /IM "antnote.exe" /T')
    
    # Limpar diretórios anteriores com verificação
    for dir_to_clean in ["dist", "dist-electron", "build"]:
        dir_path = os.path.join(app_dir, dir_to_clean)
        if os.path.exists(dir_path):
            print(f"Tentando remover diretório anterior: {dir_path}")
            try:
                shutil.rmtree(dir_path)
            except Exception as e:
                print(f"ERRO CRÍTICO: Não foi possível remover {dir_path}")
                print(f"Motivo: {e}")
                print("SOLUÇÃO: Feche qualquer aplicativo que esteja usando esta pasta (VS Code, Explorer, etc) e tente novamente.")
                return 1
            
            # Verificar se foi realmente removido
            if os.path.exists(dir_path):
                 print(f"ERRO: A pasta {dir_path} ainda existe. Algo está bloqueando a exclusão.")
                 return 1
    
    
    # Verificar arquivos necessários
    package_file = os.path.join(app_dir, "package.json")
    vite_config = os.path.join(app_dir, "vite.config.ts")
    electron_main = os.path.join(app_dir, "electron", "main.ts")
    
    files_to_check = [package_file, vite_config, electron_main]
    
    if not all(os.path.exists(p) for p in files_to_check):
        print("ERRO: Arquivos necessários não encontrados")
        print(f"  - package.json: {os.path.exists(package_file)}")
        print(f"  - vite.config.ts: {os.path.exists(vite_config)}")
        print(f"  - electron/main.ts: {os.path.exists(electron_main)}")
        input("Pressione ENTER para sair...")
        return 1
    
    # Verificar se o Node.js está instalado
    if not run_command("node --version"):
        print("ERRO: Node.js não encontrado. Por favor, instale o Node.js")
        return 1
    
    print("\nInstalando dependências...")
    
    # Limpar cache do npm
    run_command("npm cache clean --force")
    
    # Remover node_modules se existir
    node_modules = os.path.join(app_dir, "node_modules")
    if os.path.exists(node_modules):
        print("Removendo node_modules antigo...")
        shutil.rmtree(node_modules, ignore_errors=True)
    
    # Instalar TODAS as dependências
    print("\nInstalando todas as dependências...")
    if not run_command("npm install"):
        print("ERRO: Falha ao instalar dependências")
        return 1
    
    # Compilar TypeScript e Vite, depois gerar executável com Electron Builder
    print("\nCompilando TypeScript e gerando build Vite...")
    if not run_command("npm run build"):
        print("ERRO: Falha ao construir aplicação")
        return 1
    
    print("\nExecutável criado com sucesso!")
    print("\nProcurando pelo instalador...")
    
    # Procurar pelo instalador gerado
    dist_dir = os.path.join(app_dir, "dist")
    if os.path.exists(dist_dir):
        for file in glob.glob(os.path.join(dist_dir, "*.exe")):
            print(f"Instalador encontrado: {file}")
    
    print("\nProcesso concluído!")
    return 0

if __name__ == "__main__":
    sys.exit(main())