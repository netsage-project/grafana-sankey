Name: netsage-boilerplate-plugin
Version: 1.0.2
Release: 1%{?dist}
Summary: NetSage Boilerplate Grafana Plugin
Group: NetSage
License: NetSage
URL: http://www.netsage.global/
Source0: %{name}-%{version}.tar.gz
BuildRoot: %{_tmppath}/%{name}-%{version}-%{release}-root
BuildArch: noarch

BuildRequires: nodejs

%description
NetSage Boilerplate Grafana Plugin

%prep
%setup -q

%build
npm i
gulp

%install
rm -rf $RPM_BUILD_ROOT
%{__install} -d -p -m 0755 %{buildroot}/var/lib/grafana/plugins/boilerplate

cp -r dist %{buildroot}/var/lib/grafana/plugins/boilerplate/dist

find ./dist -type f -name '*' | sed 's:\./:/var/lib/grafana/plugins/boilerplate/:g' > $RPM_BUILD_DIR/file.list.%{name}

%clean
rm -rf $RPM_BUILD_ROOT
%files -f ../file.list.%{name}
%defattr(-,grafana,grafana,-)

