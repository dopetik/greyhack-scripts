#core
#/home/0xdead/include/utils.src
#/home/0xdead/include/json.src
#/home/0xdead/include/crypto.src
#/home/0xdead/include/metaxploit.src

check_passwd_access = function(object)
	lib_utils.io.print.info("* Checking access to /etc/passwd...")
	
	file = null
	object_type = typeof(object)
	
	if object_type == "shell" then
		file = object.host_computer.File("/etc/passwd")
	else if object_type == "computer" then
		file = object.File("/etc/passwd")
	else if object_type == "file" then
		file_object = object
		// Is our object a folder?
		if file_object.is_folder then
			if file_object.name == "etc" then
				files = file_object.get_files
				for filehandle in files
					if not filehandle.name == "passwd" then continue
					file = filehandle
				end for
			else
				lib_utils.io.print.error("Error: Expected /etc folder but found " + file_object.path)
				return false
			end if
			// We have a file, not folder
		else
			file = file_object
		end if
	end if
	
	if not file then
		lib_utils.io.print.error("Error: File /etc/passwd not found")
		return false
	end if
	
	if not file.has_permission("r") then
		lib_utils.io.print.error("Error: Can't read " + file.path + " permission denied")
		return false
	end if
	
	lib_utils.io.print.success("* Success! " + file.path + " is accessible")
	return true
end function

get_passwd_file = function(object)
	object_type = typeof(object)
	
	has_access = check_passwd_access(object)
	if not has_access then 
		return false
	end if
	
	if object_type == "shell" then
		file = object.host_computer.File("/etc/passwd")
		return file
	end if
	
	if object_type == "computer" then
		file = object.File("/etc/passwd")
		return file
	end if
	
	if object_type == "file" then
		if object.path == "/etc/passwd" then
			file = object
			return file
		end if
		
		// Is it a folder?
		if object.is_folder and object.name == "etc" then
			files = object.get_files
			for file in files
				if not file.name == "passwd" then continue
				return file
			end for
		end if
	end if
	
	return null
end function

get_bank_files = function(object)
	lib_utils.io.print.info("* Checking for bank accounts...")
	object_type = typeof(object)
	
	Accounts = {}
	home_folder = null
	computer = null
	found_accounts = false
	
	if object_type == "shell" then
		computer = object.host_computer
		home_folder = computer.File("/home")
	else if object_type == "computer" then
		computer = object
		home_folder = computer.File("/home")
	else if object_type == "file" then
		// Technically this could be a handle to the folder
		// /home, and we could try to iterate its folders and file
		// TODO: Implement it
		home_folder = null
	else
		// Unknown object type, dont deal with it
		home_folder = null
	end if
	
	if not home_folder then
		lib_utils.io.print.error("Error: Can't access home folder, not searching for bank accounts")
		return false
	end if
	
	user_folders = home_folder.get_folders
	for user_folder in user_folders
		bankfile = computer.File("/home/" + user_folder.name + "/Config/Bank.txt")
		if not bankfile then continue
		if not bankfile.has_permission("r") then continue
		if bankfile.content.len == 0 then continue
		
		found_accounts = true
		Accounts.push({"user": user_folder.name, "file": bankfile})
	end for
	
	if not found_accounts then
		return false
	else
		lib_utils.io.print.success("* Success!")
		return Accounts
	end if
end function

decipher_bank_accounts = function(bankfiles)
	lib_utils.io.print.info("* Attempting to decipher " + bankfiles.len + " bank accounts...")
	for account in bankfiles
		lib_crypto.decipher_file(account.key.file)
	end for
end function

decipher_passwd_file = function(passwdfile)
	lib_utils.io.print.info("* Deciphering passwd file...")
	lib_crypto.decipher_file(passwdfile)
end function

start_shell = function(shell)
	shell.start_terminal
end function

passwd_action = function(arg)
	return {"action": @decipher_passwd_file, "arg": arg, "description": "Decipher passwd file"}
end function

bank_action = function(arg)
	return {"action": @decipher_bank_accounts, "arg": arg, "description": "Decipher bank accounts"}
end function

shell_action = function(arg)
	return {"action": @start_shell, "arg": arg, "description": "Start shell"}
end function

choose_action = function(action_map)
	print
	for action in action_map
		lib_utils.io.print.info(action.key + ". " + action.value.description)
	end for
	print("choose action function")
	option = user_input("What would you like to do?: ").to_int
	while not action_map.hasIndex(option)
		choose_action(action_map)
	end while
	locals.chosen = action_map[option]
	chosen.action(chosen.arg)
end function

find_valid_vulns = function(metapath, ip, port)
	airlib = core.network.airlib(metapath, ip, port)
	vulnerabilities = airlib.run.buffer
	Exploits = {}
	
	// Setup json structure
	for vuln in vulnerabilities
		address = vuln.split(" ")[0]
		if not Exploits.hasIndex(address) then
			Exploits[address] = []
		end if
	end for
	
	for vuln in vulnerabilities
		address = vuln.split(" ")[0]
		buffer = vuln.split(" ")[1]
		type = vuln.split(" ")[2]
		Exploits[address].push({"buffer": buffer, "type": type})
	end for
	
	if port then
		fileName = ip + "-" + port
	else
		fileName = ip + "-" + 0
	end if
	save_to_disk(fileName, Exploits)
end function

save_to_disk = function(fileName, exploits)
	computer = get_shell.host_computer
	pathName = home_dir + "/targets"
	if not computer.File(pathName) then
		computer.create_folder(home_dir, "targets")
	end if
	lib_utils.io.print.info("* Saving vulnerabilities found to " + pathName + "/" + fileName)
	streamout = core.io.sout(pathName + "/" + fileName, exploits)
	streamout.write
end function

choose_vulnerable_address = function(valid_exploits)
	SelectableExploits = {}
	i = 1
	for exploit in valid_exploits
		SelectableExploits[i] = exploit
		i = i + 1
	end for
	
	print("Available exploits:")
	numberOfExploits = SelectableExploits.len
	j = 1
	while j <= numberOfExploits
		print(j + ". " + SelectableExploits[j].key)
		j = j + 1
	end while
	print
	option = user_input("Select address:").to_int
	
	while not SelectableExploits.hasIndex(option)
		option = user_input("Select address:").to_int
	end while
	
	selected = SelectableExploits[option]
	return selected
end function

choose_access_type = function(selected_address)
	SelectableAccess = {}
	i = 1
	for exploit in selected_address.value
		SelectableAccess[i] = exploit
		i = i + 1
	end for

	print("Available access through " + selected_address.key)
	numberOfExploits = SelectableAccess.len
	j = 1
	while j <= numberOfExploits
		print(j + ". " + "buffer: " + SelectableAccess[j].buffer + ", " + "type: " + SelectableAccess[j].type)
		j = j + 1
	end while
	print
	
	option = user_input("Select buffer that has the access wanted:").to_int
	
	while not SelectableAccess.hasIndex(option)
		option = user_input("Select buffer that has the access wanted:").to_int
	end while
	
	selected = SelectableAccess[option]
	return {"address": selected_address.key, "exploit": selected}
end function

ip = lib_utils.argparse.get_arg("-ip")
port = lib_utils.argparse.get_arg("-port")
optarg = false

// Minimum requirement to use the program
if not ip or params.len == 0 then
	lib_utils.program.usage("[-ip] [-port (opt)]")
end if

metalib = lib_metaxploit.establish_connection(ip, port)
if not metalib then
	lib_utils.program.exit("Error: Can't establish a net session, check the ip and or port")
end if
lib_utils.io.print.info("Targeting " + metalib.lib_name + " v" + metalib.version)

// If we have a json file with exploit info, use it, else make one
jsonPath = home_dir + "/targets"

// In case target is a router
if port then
	jsonFileName = ip + "-" + port
else
	jsonFileName = ip + "-" + "0"
end if

if not get_shell.host_computer.File(jsonPath + "/" + jsonFileName) then
	lib_utils.io.print.info("* Finding usable exploits...")
	find_valid_vulns("/lib/metaxploit.so", ip, port)
	print
end if

// get a selected exploit to run
lib_utils.io.print.info("* Found these working exploits...")
jsonFullPath = jsonPath + "/" + jsonFileName

json_exploits = core.io.sin(jsonFullPath).read
jObject = {}
valid_exploits = lib_json.parse(json_exploits,jObject,false)
selected_address = choose_vulnerable_address(valid_exploits)
final = choose_access_type(selected_address)
// number exploits are password change exploits or for routers, a LAN ip is needed
if final.exploit.type == "number" then
	if port then
		optarg = "r4cken"
	else
		optarg = user_input("Target is a router, please supply a LAN ip: ")
	end if
end if

result = lib_metaxploit.execute_exploit(metalib, final.address, final.exploit.buffer, optarg)
if not result then 
	lib_utils.program.exit("Error: Exploit failed")
end if

// Exfiltrated data
passwd_file = get_passwd_file(result)
bank_files = get_bank_files(result)

exploit_type = typeof(result)
if exploit_type == "shell" then
	i = 1
	SupportedActions = {}
	
	if passwd_file then
		SupportedActions[i] = passwd_action(passwd_file)
		i = i + 1
	end if
	
	if bank_files then
		SupportedActions[i] = bank_action(bank_files)
		i = i + 1
	end if
	
	SupportedActions[i] = shell_action(result)
	choose_action(SupportedActions)
else if exploit_type == "computer" then
	i = 1
	SupportedActions = {}
	
	if passwd_file then
		SupportedActions[i] = passwd_action(passwd_file)
		i = i + 1
	end if
	
	if bank_files then
		SupportedActions[i] = bank_action(bank_files)
		i = i + 1
	end if
	choose_action(SupportedActions)
else if exploit_type == "file" then
	i = 1
	SupportedActions = {}
	
	if passwd_file then
		SupportedActions[i] = passwd_action(passwd_file)
		choose_action(SupportedActions)
	else
		lib_utils.io.print.info("Recieved filehandle to " + result.path + " unsure what to do with that.")
	end if
	
else if exploit_type == "number" then
	lib_utils.io.print.info("Password change made")
else
	lib_utils.program.exit("Error: Unknown type of exploit")
end if