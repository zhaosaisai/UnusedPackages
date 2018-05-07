const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

function findPackageName(package = '') {
    let reg = /\/node_modules\/([^\/]+)\/?/
    let match = package.match(reg)
    return match && match[1]
}

function getPackageJSONFile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, 'utf8', (err, data) => {
            if(err) {
                reject(err)
            }
            resolve(JSON.parse(data))
        })
    })
}

function displayUnusedPackages(unpkgs, pkgs) {
    let unusedPkgs = chalk.red('\n==========unused packages in project===========\n')
    unpkgs.forEach(pkg => {
        unusedPkgs += chalk.red(`${pkg}: ${pkgs[pkg]}\n`)
    })
    unusedPkgs += '\n\n'
    unusedPkgs += 'You can uninstall them by the command\n\n'
    unusedPkgs += chalk.underline.bold.yellow(`npm uninstall ${unpkgs.join(' ')}`)
    unusedPkgs += '\n\nor\n\n'
    unusedPkgs += chalk.underline.bold.yellow(`yarn remove ${unpkgs.join(' ')}`)
    return unusedPkgs
}

class UnusedPackages {
    constructor(options) {
        // 项目中使用的package
        this.packages = new Set()
        // 没有在项目中使用但是已经安装了的包
        this.unusedPackages = new Set()
        // package.json中的dep
        this.pkgs = {}
    }

    selectUnusedPackages(deps = {}) {
        Object.keys(deps).forEach(dep => {
            if(!this.packages.has(dep)) {
                this.unusedPackages.add(dep)
            }
        })
    }

    reset() {
        this.packages = new Set()
        this.unusedPackages = new Set()
    }

    apply(compiler) {
        const context = compiler.options.context
        
        compiler.plugin('emit', (compliation, callback) => {
            this.reset()
            getPackageJSONFile(path.resolve(context, 'package.json')).then(options => {
                this.pkgs = options.dependencies
                
                compliation.chunks.forEach((chunk) => {
                    chunk.forEachModule((module) => {
                        if(module.fileDependencies) {
                            module.fileDependencies.forEach((dep) => {
                                if(dep.indexOf('node_modules') > -1) {
                                    let packageName = findPackageName(dep)
                                    packageName && this.packages.add(packageName)
                                }
                            }) 
                        }
                    })
                })
                this.selectUnusedPackages(options.dependencies);
                callback();
            }).catch(err => {
                compliation.errors.push(err)
            })
        })
        compiler.plugin('done', (stats) => {
            let unusedPackagesArr = Array.from(this.unusedPackages)
            unusedPackagesArr.length > 0 && console.log(displayUnusedPackages(unusedPackagesArr, this.pkgs))
        }) 
    }
}

module.exports = UnusedPackages